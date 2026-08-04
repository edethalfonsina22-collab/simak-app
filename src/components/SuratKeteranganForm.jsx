{showForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
    <form
      onSubmit={handleSubmit}
      className="card relative overflow-hidden w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
    >
      <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-red-900" />

      <button
        type="button"
        onClick={() => setShowForm(false)}
        className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"
      >
        <X size={20} />
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
          <GraduationCap size={19} />
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">
            {editingId ? 'Ubah Data Guru' : 'Tambah Guru'}
          </h2>
          <p className="text-sm text-ink-700/50">
            Lengkapi data identitas guru
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">

        {/* Nama */}
        <Field label="Nama Lengkap" full>
          <input
            required
            className="input-field"
            value={form.nama_lengkap}
            onChange={(e) =>
              setForm({ ...form, nama_lengkap: e.target.value })
            }
            placeholder="Nama lengkap dan gelar"
          />
        </Field>

        {/* NIP */}
        <Field label="NIP">
          <input
            className="input-field"
            value={form.nip}
            onChange={(e) =>
              setForm({ ...form, nip: e.target.value })
            }
            placeholder="NIP"
          />
        </Field>

        {/* NUPTK */}
        <Field label="NUPTK">
          <input
            className="input-field"
            value={form.nuptk}
            onChange={(e) =>
              setForm({ ...form, nuptk: e.target.value })
            }
            placeholder="NUPTK"
          />
        </Field>

        {/* Jenis Kelamin */}
        <Field label="Jenis Kelamin">
          <select
            className="input-field"
            value={form.jenis_kelamin}
            onChange={(e) =>
              setForm({ ...form, jenis_kelamin: e.target.value })
            }
          >
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </Field>

        {/* Mata Pelajaran */}
        <Field label="Mata Pelajaran">
          <input
            className="input-field"
            value={form.mata_pelajaran}
            onChange={(e) =>
              setForm({ ...form, mata_pelajaran: e.target.value })
            }
            placeholder="Contoh: Guru Kelas"
          />
        </Field>

        {/* Pangkat / Golongan */}
        <Field label="Pangkat / Golongan">
          <input
            className="input-field"
            value={form.pangkat_golongan}
            onChange={(e) =>
              setForm({ ...form, pangkat_golongan: e.target.value })
            }
            placeholder="Contoh: Penata Muda / III-b"
          />
        </Field>

        {/* Pendidikan */}
        <Field label="Pendidikan Terakhir">
          <input
            className="input-field"
            value={form.pendidikan_terakhir}
            onChange={(e) =>
              setForm({ ...form, pendidikan_terakhir: e.target.value })
            }
            placeholder="Contoh: S1 PGSD"
          />
        </Field>

        {/* Tanggal Lahir */}
        <Field label="Tanggal Lahir">
          <input
            type="date"
            className="input-field"
            value={form.tanggal_lahir || ''}
            onChange={(e) =>
              setForm({ ...form, tanggal_lahir: e.target.value })
            }
          />
        </Field>

        {/* No HP */}
        <Field label="No. HP">
          <input
            className="input-field"
            value={form.no_hp}
            onChange={(e) =>
              setForm({ ...form, no_hp: e.target.value })
            }
            placeholder="08xxxxxxxxxx"
          />
        </Field>

        {/* Email */}
        <Field label="Email">
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            placeholder="email@contoh.com"
          />
        </Field>

        {/* Status */}
        <Field label="Status">
          <select
            className="input-field"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value })
            }
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </Field>

        {/* Alamat */}
        <Field label="Alamat" full>
          <textarea
            className="input-field min-h-[80px]"
            value={form.alamat}
            onChange={(e) =>
              setForm({ ...form, alamat: e.target.value })
            }
            placeholder="Alamat lengkap"
          />
        </Field>

        {/* Foto Profil Path */}
        <Field label="Path Foto Profil" full>
          <input
            className="input-field"
            value={form.foto_profil_path}
            onChange={(e) =>
              setForm({
                ...form,
                foto_profil_path: e.target.value,
              })
            }
            placeholder="Contoh: id-guru/foto.jpg"
          />

          <p className="text-xs text-ink-700/50 mt-1">
            Kosongkan jika guru belum memiliki foto.
          </p>
        </Field>

      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowForm(false)}
        >
          Batal
        </button>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving && (
            <Loader2 size={16} className="animate-spin" />
          )}

          {saving ? 'Menyimpan...' : 'Simpan Data Guru'}
        </button>
      </div>
    </form>
  </div>
)}
