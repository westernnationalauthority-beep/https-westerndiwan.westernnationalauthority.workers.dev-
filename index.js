import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request, env, ctx) {
    // جلب رابط قاعدة البيانات من متغيرات البيئة في كلادوفلير
    const sql = neon(env.DATABASE_URL);

    // التحقق من المسار الرئيسي
    const url = new URL(request.url);
    if (url.pathname === "/") {
      try {
        const [result] = await sql`SELECT version()`;
        const version = result?.version || 'No version found';
        
        return new Response(JSON.stringify({ version }), {
          headers: { "content-type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to connect to the database.' }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
