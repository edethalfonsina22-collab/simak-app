import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient"; // sesuaikan path kalau berbeda di project kamu

// =========================================================
// CartContext
// - Menyimpan isi keranjang per toko (karena 1 aplikasi bisa
//   melayani banyak toko), disimpan di localStorage supaya
//   tidak hilang kalau halaman di-refresh.
// - Cart di-scope per user_id, supaya tidak "nempel" ke user
//   lain yang login di browser/device yang sama.
// - Bungkus <App /> dengan <CartProvider> di App.jsx.
// =========================================================

const CartContext = createContext(null);

function getStorageKey(userId) {
  return userId ? `simak_keranjang_${userId}` : null;
}

function loadCart(storageKey) {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
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
      (_event, session) => {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        setCart(loadCart(getStorageKey(uid))); // ganti isi cart sesuai user baru
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Simpan ke localStorage tiap kali cart berubah (hanya kalau sudah tahu user-nya)
  useEffect(() => {
    if (!ready) return;
    const storageKey = getStorageKey(userId);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    }
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
