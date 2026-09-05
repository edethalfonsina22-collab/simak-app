import { createContext, useContext, useEffect, useState, useCallback } from "react";

// =========================================================
// CartContext
// - Menyimpan isi keranjang per toko (karena 1 aplikasi bisa
//   melayani banyak toko), disimpan di localStorage supaya
//   tidak hilang kalau halaman di-refresh.
// - Bungkus <App /> dengan <CartProvider> di App.jsx.
// =========================================================

const CartContext = createContext(null);
const STORAGE_KEY = "simak_keranjang";

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function CartProvider({ children }) {
  // Bentuk data: { [tokoId]: { [barangId]: { id, nama_barang, harga, satuan, stok, qty } } }
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

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
