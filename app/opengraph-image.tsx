import { ImageResponse } from "next/og";
export const alt =
  "NVO Restaurant — a royal welcome, an unforgettable taste in Cotonou";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#0c244e",
        color: "#fff8ec",
        display: "flex",
        padding: 50,
      }}
    >
      <div
        style={{
          border: "1px solid #ba9a5d",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 60,
        }}
      >
        <div style={{ fontSize: 25, color: "#e4c58c", letterSpacing: 8 }}>
          NVO RESTAURANT & BAR
        </div>
        <div style={{ fontSize: 80, lineHeight: 1.1, marginTop: 38 }}>
          A royal welcome.
        </div>
        <div style={{ fontSize: 66, color: "#e4c58c", marginTop: 5 }}>
          An unforgettable taste.
        </div>
        <div style={{ fontSize: 23, marginTop: 42, color: "#c7d3e6" }}>
          Nigerian flavours · Seafood · Agblangandan, Cotonou
        </div>
      </div>
    </div>,
    size,
  );
}
