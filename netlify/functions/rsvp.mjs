import { getStore } from "@netlify/blobs";

const store = getStore("ika-jaka-rsvp");

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

function clean(value, max = 500) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export default async function handler(req) {
  try {
    /*
      GET
      Mengambil semua RSVP/ucapan yang sudah tersimpan.
    */
    if (req.method === "GET") {
      const { blobs } = await store.list({
        consistency: "strong"
      });

      const entries = [];

      for (const blob of blobs) {
        const data = await store.get(blob.key, {
          type: "json",
          consistency: "strong"
        });

        if (data) {
          entries.push(data);
        }
      }

      entries.sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      return response({
        ok: true,
        entries
      });
    }

    /*
      POST
      Menyimpan RSVP baru.
    */
    if (req.method === "POST") {
      let body;

      try {
        body = await req.json();
      } catch {
        return response({
          ok: false,
          error: "Data RSVP tidak valid."
        }, 400);
      }

      /*
        Honeypot anti-spam.
        Field ini disembunyikan dari pengguna normal.
      */
      if (body.website) {
        return response({
          ok: true,
          message: "Terima kasih."
        });
      }

      const name = clean(body.name, 100);
      const attendance = clean(body.attendance, 30);
      const message = clean(body.message, 500);

      let count = Number(body.count);

      if (!name) {
        return response({
          ok: false,
          error: "Nama wajib diisi."
        }, 400);
      }

      if (
        attendance !== "Hadir" &&
        attendance !== "Tidak Hadir"
      ) {
        return response({
          ok: false,
          error: "Pilihan kehadiran tidak valid."
        }, 400);
      }

      if (!Number.isInteger(count) || count < 1 || count > 5) {
        count = 1;
      }

      const entry = {
        id: crypto.randomUUID(),
        name,
        attendance,
        count,
        message,
        createdAt: new Date().toISOString()
      };

      /*
        Setiap ucapan disimpan sebagai file/blob sendiri.
        Jadi ucapan lama tidak tertimpa oleh ucapan baru.
      */
      const key = `entries/${entry.id}.json`;

      await store.setJSON(key, entry);

      return response({
        ok: true,
        entry
      }, 201);
    }

    return response({
      ok: false,
      error: "Method tidak didukung."
    }, 405);

  } catch (error) {
    console.error("RSVP ERROR:", error);

    return response({
      ok: false,
      error: "Terjadi kesalahan pada server. Silakan coba lagi."
    }, 500);
  }
}