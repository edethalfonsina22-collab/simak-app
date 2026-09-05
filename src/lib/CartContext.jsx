import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient"; // sesuaikan path kalau berbeda di project kamu

// =========================================================
// CartContext
// - Menyimpan isi keranjang per toko (karena 1 aplikasi bisa
//   melayani banyak toko), disimpan di localStorage supaya
//   tidak hilang kalau halaman di-refresh.
// - Cart di-scope per user_id, supaya tidak "nempel" ke user
//   lain yang login di browser/device yang sama.
// - Tamu (belum login) punya slot tersendiri (GUEST_KEY). Saat
//   tamu login, isi keranjangnya digabung ke keranjang akun yang
//   baru login, lalu slot tamu dikosongkan.
// - Bungkus <App /> dengan <CartProvider> di App.jsx.
// =========================================================

const CartContext = createContext(null);
const GUEST_KEY = "simak_keranjang_tamu";

function getStorageKey(userId) {
  return userId ? `simak_keranjang_${userId}` : GUEST_KEY;
}

function loadCart(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Gabungkan keranjang tamu ke keranjang milik user yang baru login.
// Kalau barang yang sama sudah ada di keduanya, qty dijumlah (tetap
// dibatasi oleh stok barang tsb).
function mergeCarts(guestCart, userCart) {
  const merged = { ...userCart };
  for (const tokoId of Object.keys(guestCart)) {
    const guestTokoCart = guestCart[tokoId] || {};
    const userTokoCart = { ...(merged[tokoId] || {}) };
    for (const barangId of Object.keys(guestTokoCart)) {
      const guestItem = guestTokoCart[barangId];
      const existing = userTokoCart[barangId];
      const maxQty = guestItem.stok ?? Infinity;
      const qty = Math.min((existing?.qty || 0) + guestItem.qty, maxQty);
      userTokoCart[barangId] = { ...guestItem, ...existing, qty };
    }
    merged[tokoId] = userTokoCart;
  }
  return merged;
}

export function CartProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);
  // Bentuk data: { [tokoId]: { [barangId]: { id, nama_barang, harga, satuan, stok, qty } } }
  const [cart, setCart] = useState({});

  // Pantau status login & muat cart sesuai user yang aktif
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      setCart(loadCart(getStorageKey(uid)));
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const uid = session?.user?.id ?? null;

        if (event === "SIGNED_IN") {
          // Baru saja login: gabungkan keranjang tamu (kalau ada isinya) ke
          // keranjang milik akun ini, lalu bersihkan slot tamu supaya tidak
          // "bocor" ke tamu berikutnya yang memakai browser/device yang sama.
          const guestCart = loadCart(GUEST_KEY);
          const userCart = loadCart(getStorageKey(uid));
          const merged = mergeCarts(guestCart, userCart);
          setCart(merged);
          localStorage.setItem(getStorageKey(uid), JSON.stringify(merged));
          localStorage.removeItem(GUEST_KEY);
        } else {
          // Restore sesi biasa (refresh halaman) atau logout — cukup muat
          // ulang keranjang sesuai slot user/tamu yang sedang aktif.
          setCart(loadCart(getStorageKey(uid)));
        }

        setUserId(uid);
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Simpan ke localStorage tiap kali cart berubah (hanya kalau sudah tahu
  // slot mana yang sedang dipakai — user atau tamu).
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(getStorageKey(userId), JSON.stringify(cart));
  }, [cart, userId, ready]);

  const addItem = useCallback((tokoId, barang, qty = 1) => {
    setCart((prev) => {
      const tokoCart = { ...(prev[tokoId] || {}) };
      const existing = tokoCart[barang.id];
      const maxQty = barang.stok ?? Infinity;
      const nextQty = Math.min((existing?.qty || 0) + qty, maxQty);

      tokoCart[barang.id] = {
        id: barang.id,
        nama_barang: barang.nama_barang,
        harga: barang.harga,
        satuan: barang.satuan,
        stok: barang.stok,
        qty: nextQty,
      };
      return { ...prev, [tokoId]: tokoCart };
    });
  }, []);

  const updateQty = useCallback((tokoId, barangId, qty) => {
    setCart((prev) => {
      const tokoCart = { ...(prev[tokoId] || {}) };
      const item = tokoCart[barangId];
      if (!item) return prev;

      if (qty <= 0) {
        delete tokoCart[barangId];
      } else {
        const maxQty = item.stok ?? Infinity;
        tokoCart[barangId] = { ...item, qty: Math.min(qty, maxQty) };
      }
      return { ...prev, [tokoId]: tokoCart };
    });
  }, []);

  const removeItem = useCallback((tokoId, barangId) => {
    setCart((prev) => {
      const tokoCart = { ...(prev[tokoId] || {}) };
      delete tokoCart[barangId];
      return { ...prev, [tokoId]: tokoCart };
    });
  }, []);

  const clearCart = useCallback((tokoId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[tokoId];
      return next;
    });
  }, []);

  const getCartItems = useCallback(
    (tokoId) => Object.values(cart[tokoId] || {}),
    [cart]
  );

  const getCartCount = useCallback(
    (tokoId) =>
      Object.values(cart[tokoId] || {}).reduce((sum, i) => sum + i.qty, 0),
    [cart]
  );

  const value = {
    addItem,
    updateQty,
    removeItem,
    clearCart,
    getCartItems,
    getCartCount,
  };

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart harus dipakai di dalam <CartProvider>");
  }
  return ctx;
}
