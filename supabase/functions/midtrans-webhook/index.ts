// =========================================================
// Edge Function: midtrans-webhook
// URL function ini didaftarkan di dashboard Midtrans sebagai
// "Payment Notification URL". Midtrans akan memanggil endpoint
// ini setiap kali status pembayaran berubah (pending, settlement,
// deny, cancel, expire, dst).
//
// TIDAK perlu header Authorization dari Midtrans — keamanan
// diverifikasi lewat signature_key (lihat verifySignature di bawah),
// bukan lewat JWT Supabase.
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
  try {
    const body = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
    } = body;

    // Verifikasi signature supaya notifikasi ini benar dari Midtrans,
    // bukan orang lain yang menebak-nebak endpoint ini.
    const expectedSignature = await sha512Hex(
      `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`,
    );

    if (expectedSignature !== signature_key) {
      return new Response(JSON.stringify({ error: "Signature tidak valid" }), {
        status: 403,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pesanan, error: findError } = await supabase
      .from("pesanan")
      .select("id, status_bayar")
      .eq("midtrans_order_id", order_id)
      .single();

    if (findError || !pesanan) {
      // Order id tidak ditemukan di database kita — tetap balas 200 supaya
      // Midtrans tidak mengulang-ulang notifikasi untuk order asing.
      return new Response(JSON.stringify({ message: "Pesanan tidak ditemukan, diabaikan" }), {
        status: 200,
      });
    }

    // Pemetaan status Midtrans -> status_bayar kita
    if (
      transaction_status === "capture" &&
      (fraud_status === "accept" || !fraud_status)
    ) {
      await supabase
        .from("pesanan")
        .update({
          status_bayar: "dibayar",
          metode_bayar: payment_type,
          dibayar_pada: new Date().toISOString(),
        })
        .eq("id", pesanan.id);
    } else if (transaction_status === "settlement") {
      await supabase
        .from("pesanan")
        .update({
          status_bayar: "dibayar",
          metode_bayar: payment_type,
          dibayar_pada: new Date().toISOString(),
        })
        .eq("id", pesanan.id);
    } else if (transaction_status === "pending") {
      await supabase
        .from("pesanan")
        .update({ metode_bayar: payment_type })
        .eq("id", pesanan.id);
      // status_bayar dibiarkan 'menunggu'
    } else if (
      transaction_status === "deny" ||
      transaction_status === "cancel"
    ) {
      // Kembalikan stok barang + tandai gagal (lihat fungsi di pembayaran_schema.sql)
      await supabase.rpc("batalkan_pesanan", {
        p_pesanan_id: pesanan.id,
        p_status_baru: "gagal",
      });
    } else if (transaction_status === "expire") {
      await supabase.rpc("batalkan_pesanan", {
        p_pesanan_id: pesanan.id,
        p_status_baru: "kedaluwarsa",
      });
    }

    return new Response(JSON.stringify({ message: "OK" }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});
