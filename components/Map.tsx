"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Permit } from "@/lib/types";
import { urgency } from "@/lib/format";

function FlyTo({ permit }: { permit: Permit | null }) {
  const map = useMap();
  useEffect(() => {
    if (permit) map.flyTo([permit.lat, permit.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [permit, map]);
  return null;
}

export default function Map({ permits, selected, onSelect }: {
  permits: Permit[]; selected: Permit | null; onSelect: (p: Permit) => void;
}) {
  return (
    <MapContainer center={[36.165, -86.78]} zoom={11} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {permits.map((p) => {
        const isSel = selected?.id === p.id;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={isSel ? 12 : 8}
            pathOptions={{ color: "#1E1E1E", weight: isSel ? 4 : 2, fillColor: urgency(p.dateIssued).color, fillOpacity: 0.95 }}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{p.address.split(",")[0]}</Tooltip>
          </CircleMarker>
        );
      })}
      <FlyTo permit={selected} />
    </MapContainer>
  );
}
