import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request, env, ctx) {
    const sql = neon(env.DATABASE_URL);
    const url = new URL(request.url);

    if (url.pathname === "/") {
      try {
        // جلب إصدار قاعدة البيانات
        const [result] = await sql`SELECT version()`;
        const version = result?.version || 'No version found';
        
        // صفحة الويب المصممة بـ HTML و CSS
        const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>لوحة التحكم | ديوان الويب</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f4f7f6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .card {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 500px;
                    width: 90%;
                }
                h1 { color: #2c3e50; font-size: 24px; margin-bottom: 10px; }
                p { color: #7f8c8d; font-size: 16px; line-height: 1.6; }
                .status {
                    display: inline-block;
                    padding: 8px 15px;
                    background-color: #2ecc71;
                    color: white;
                    border-radius: 20px;
                    font-weight: bold;
                    margin-top: 15px;
                    font-size: 14px;
                }
                .db-info {
                    background: #ecf0f1;
                    padding: 12px;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 12px;
                    text-align: left;
                    direction: ltr;
                    margin-top: 20px;
                    word-break: break-all;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>مرحباً بك في موقعك الجديد! 🚀</h1>
                <p>تم ربط الكود المستضاف على <strong>Cloudflare Workers</strong> بنجاح تام، وعرض هذه الواجهة التفاعلية الحية.</p>
                <span class="status">✓ قاعدة البيانات متصلة</span>
                <div class="db-info">
                    <strong>Database Version:</strong><br>${version}
                </div>
            </div>
        </body>
        </html>
        `;

        return new Response(html, {
          headers: { "content-type": "text/html; charset=UTF-8" },
        });

      } catch (error) {
        return new Response("خطأ في الاتصال بقاعدة البيانات", { status: 500 });
      }
    }

    return new Response("الصفحة غير موجودة", { status: 404 });
  },
};
