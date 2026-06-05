import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BiteBase — Bite-sized Learning Powered by AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  // Load the serif font for the brand title
  const fontBold = await fetch(
    new URL("./fonts/fraunces-latin.woff2", import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #3730a3 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-160px",
            left: "-60px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Brand name */}
          <div
            style={{
              fontSize: 88,
              color: "white",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontFamily: "'Fraunces'",
            }}
          >
            BiteBase
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 28,
              color: "rgba(255, 255, 255, 0.85)",
              marginTop: 20,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            Bite-sized Learning Powered by AI
          </div>

          {/* Divider dot */}
          <div
            style={{
              width: 40,
              height: 3,
              borderRadius: 2,
              background: "rgba(255, 255, 255, 0.3)",
              marginTop: 24,
            }}
          />

          {/* Description */}
          <div
            style={{
              fontSize: 18,
              color: "rgba(255, 255, 255, 0.7)",
              marginTop: 16,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: 400,
            }}
          >
            Tell BiteBase what you want to learn. Get a personalized
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255, 255, 255, 0.7)",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: 400,
            }}
          >
            curriculum with lessons and quizzes, generated just for you.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Fraunces",
          data: fontBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
