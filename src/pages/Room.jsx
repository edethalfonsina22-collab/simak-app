import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { supabase } from "../supabaseClient"; // sesuaikan path client Supabase Anda yang sudah ada

export default function Room() {
  const { roomId } = useParams();
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchToken = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Anda harus login dulu");
        return;
      }

      const res = await fetch("/api/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: roomId,
          participantName: user.email ?? user.id,
        }),
      });

      if (!res.ok) {
        setError("Gagal mengambil token");
        return;
      }

      const data = await res.json();
      setToken(data.token);
    };

    fetchToken();
  }, [roomId]);

  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!token) return <div className="p-4">Menghubungkan...</div>;

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100vh" }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
