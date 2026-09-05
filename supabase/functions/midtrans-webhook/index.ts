// =========================================================
// Edge Function: midtrans-webhook
// URL function ini didaftarkan di dashboard Midtrans sebagai
// "Payment Notification URL". Midtrans akan memanggil endpoint
// ini setiap kali status pembayaran berubah (pending, settlement,
// deny, cancel, expire, dst).
//
// TIDAK perlu header Authorization dari Midtrans — keamanan
// diverifikasi lewat signature_key (lihat verifySignature di bawah),
// bukan lewat JWT Supabase. Karena itu deploy dengan --no-verify-jwt.
//
// Disesuaikan dengan skema: tabel `pesanan` (kolom status_bayar,
// midtrans_order_id, metode_bayar, dibayar_pada) + RPC batalkan_pesanan.
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!;

async function sha512Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();

    // PENTING: pakai nilai mentah dari body (string), JANGAN di-convert
    // ke number. Signature Midtrans dihitung dari string persis seperti
    // yang mereka kirim — kalau status_code/gross_amount diubah tipe,
    // hasil hash akan selalu mismatch walau datanya "sama".
    const order_id: string = body.order_id;
    const status_code: string = body.status_code;
    const gross_amount: string = body.gross_amount;
    const signature_key: string = body.signature_key;
    const transaction_status: string = body.transaction_status;
    const fraud_status: string | undefined = body.fraud_status;
    const payment_type: string | undefined = body.payment_type;

    // 1. Verifikasi signature dulu, sebelum menyentuh database sama sekali
    const expectedSignature = await sha512Hex(
      `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`,
    );
    if (expectedSignature !== signature_key) {
      console.error("Signature tidak valid untuk order_id:", order_id);
      // Tetap 200 ke Midtrans supaya tidak retry terus untuk notifikasi
      // palsu/rusak — cukup dicatat di log, bukan diteruskan sebagai error.
      return new Response(JSON.stringify({ message: "Signature tidak valid, diabaikan" }), {
        status: 200,
      });
    }

    // 2. Cari pesanan berdasarkan midtrans_order_id
    const { data: pesanan, error: findError } = await supabase
      .from("pesanan")
      .select("id, status_bayar")
      .eq("midtrans_order_id", order_id)
      .single();

    if (findError || !pesanan) {
      console.error("Pesanan tidak ditemukan untuk order_id:", order_id, findError);
      // Order id tidak dikenal — tetap balas 200 supaya Midtrans berhenti
      // mengulang-ulang notifikasi untuk order yang bukan urusan kita.
      return new Response(JSON.stringify({ message: "Pesanan tidak ditemukan, diabaikan" }), {
        status: 200,
      });
    }

    // 3. Kalau pesanan sudah final, jangan diproses ulang (idempotent)
    if (pesanan.status_bayar !== "menunggu") {
      return new Response(
        JSON.stringify({ message: `Pesanan sudah berstatus '${pesanan.status_bayar}', dilewati` }),
        { status: 200 },
      );
    }

    // 4. Pemetaan status Midtrans -> status_bayar
    if (
      (transaction_status === "capture" && (fraud_status === "accept" || !fraud_status)) ||
      transaction_status === "settlement"
    ) {
      const { error } = await supabase
        .from("pesanan")
        .update({
          status_bayar: "dibayar",
          metode_bayar: payment_type ?? null,
          dibayar_pada: new Date().toISOString(),
        })
        .eq("id", pesanan.id);
      if (error) console.error("Gagal update status dibayar:", error);
    } else if (transaction_status === "pending") {
      const { error } = await supabase
        .from("pesanan")
        .update({ metode_bayar: payment_type ?? null })
        .eq("id", pesanan.id);
      if (error) console.error("Gagal update metode_bayar (pending):", error);
      // status_bayar tetap 'menunggu'
    } else if (transaction_status === "deny" || transaction_status === "cancel") {
      const { error } = await supabase.rpc("batalkan_pesanan", {
        p_pesanan_id: pesanan.id,
        p_status_baru: "gagal",
      });
      if (error) console.error("Gagal batalkan_pesanan (deny/cancel):", error);
    } else if (transaction_status === "expire") {
      const { error } = await supabase.rpc("batalkan_pesanan", {
        p_pesanan_id: pesanan.id,
        p_status_baru: "kedaluwarsa",
      });
      if (error) console.error("Gagal batalkan_pesanan (expire):", error);
    } else {
      console.log("transaction_status tidak dikenali, diabaikan:", transaction_status);
    }

    return new Response(JSON.stringify({ message: "OK" }), { status: 200 });
  } catch (err) {
    console.error("Error tak terduga di midtrans-webhook:", err);
    // Tetap balas 200 supaya Midtrans tidak spam-retry karena bug internal kita.
    // Yang penting errornya sudah tercatat di log (Supabase Dashboard > Edge Functions > Logs).
    return new Response(JSON.stringify({ error: String(err) }), { status: 200 });
  }
});
