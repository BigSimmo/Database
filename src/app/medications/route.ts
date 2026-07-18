export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: "/?mode=prescribing" },
  });
}

export const HEAD = GET;
