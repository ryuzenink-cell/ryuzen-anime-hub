import { authorizeAdmin } from "../../_utils/auth.js";
export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return new Response(null, { status: 204 });
  const rejection = authorizeAdmin(context.request, context.env);
  return rejection || context.next();
}
