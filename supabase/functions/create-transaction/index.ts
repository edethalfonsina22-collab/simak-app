// =========================================================
// Edge Function: create-transaction
// Dipanggil dari Checkout.jsx SETELAH pesanan berhasil dibuat
// (setelah RPC buat_pesanan sukses). Menerima { pesanan_id },
// membuat transaksi Snap di Midtrans, menyimpan snap_token ke
// tabel pesanan, dan mengembalikan snap_token ke frontend.
//
// CATATAN PENTING — SESUAIKAN dengan skema Anda:
// - Kode ini mengasumsikan tabel `pesanan` punya kolom
//   `total_harga` (angka total pesanan) dan `pembeli_id`
//   (uuid, merujuk ke auth.users / profil). Ganti nama kolom
//   di bawah kalau nama di skema Anda berbeda.
// - Kode ini mengasumsikan tabel `pesanan_item` punya kolom
//   `barang_id`, `jumlah`, `harga_satuan` dan berelasi ke
//   tabel `barang` (untuk nama barang). Sesuaikan juga bila
//   berbeda.
// =========================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!;
// Ganti ke "https://app.midtrans.com/snap/v1/transactions" saat sudah go-live
const MIDTRANS_SNAP_URL = "https://app.sandbox.midtrans.com/snap/v1/transactions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pesanan_id } = await req.json();
    if (!pesanan_id) {
      return new Response(JSON.stringify({ error: "pesanan_id wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client — hanya berjalan di server, aman untuk bypass RLS
    // karena kita sudah tahu pesanan_id ini valid milik pemanggil (dicek di
    // bawah lewat token Authorization dari frontend).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifikasi identitas pemanggil dari header Authorization (JWT user biasa,
    // BUKAN service role) supaya orang lain tidak bisa membuat transaksi untuk
    // pesanan_id milik orang lain.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Tidak terautentikasi" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ambil data pesanan + item + barang
    const { data: pesanan, error: pesananError } = await supabase
      .from("pesanan")
      .select(
        "id, total_harga, pembeli_id, status_bayar, midtrans_order_id, snap_token, pesanan_item(jumlah, harga_satuan, barang_id, barang(nama_barang))",
      )
      .eq("id", pesanan_id)
      .single();

    if (pesananError || !pesanan) {
      return new Response(JSON.stringify({ error: "Pesanan tidak ditemukan" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pesanan.pembeli_id !== user.id) {
      return new Response(JSON.stringify({ error: "Pesanan ini bukan milik Anda" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Kalau sudah ada snap_token yang masih berlaku dan pesanan masih
    // menunggu bayar, pakai ulang saja (Snap token berlaku ~24 jam) supaya
    // tidak membuat transaksi baru tiap kali popup dibuka ulang.
    if (pesanan.status_bayar === "menunggu" && pesanan.snap_token) {
      return new Response(JSON.stringify({ snap_token: pesanan.snap_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const midtransOrderId = `pesanan-${pesanan.id}-${Date.now()}`;

    const itemDetails = (pesanan.pesanan_item ?? []).map((it: any) => ({
      id: it.barang_id,
      price: Math.round(it.harga_satuan),
      quantity: it.jumlah,
      name: (it.barang?.nama_barang ?? "Barang").slice(0, 50),
    }));

    const grossAmount = Math.round(Number(pesanan.total_harga));

    const midtransRes = await fetch(MIDTRANS_SNAP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic " + btoa(MIDTRANS_SERVER_KEY + ":"),
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: grossAmount,
        },
        item_details: itemDetails,
        customer_details: {
          email: user.email,
        },
      }),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok) {
      return new Response(
        JSON.stringify({ error: "Gagal membuat transaksi Midtrans", detail: midtransData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simpan snap_token & order_id ke pesanan supaya webhook bisa mencocokkan
    await supabase
      .from("pesanan")
      .update({
        midtrans_order_id: midtransOrderId,
        snap_token: midtransData.token,
      })
      .eq("id", pesanan.id);

    return new Response(JSON.stringify({ snap_token: midtransData.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
