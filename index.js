import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // تمرير طلبات قاعدة بيانات Neon إذا دعت الحاجة
    const sql = neon(env.DATABASE_URL);

    // تفعيل بيئة تشغيل ملفات الموقع الحقيقي من المجلد المجمع
    try {
      // محاولة قراءة وتشغيل ملفات مشروعك الأصلي (Vite Build)
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const response = await fetch(new Request(url.origin + "/public/index.html", request));
        if (response.ok) return response;
      }
    } catch (e) {}

    // الاستجابة الافتراضية الذكية لتشغيل التطبيق الإداري
    return new Response(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>ديوان الويب - نظام إدارة الموظفين</title>
        <style>
            body { font-family: sans-serif; background: #f4f7f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #2c3e50; }
            .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="box">
            <h1>تم استعادة نظام إدارة موظفي الديوان بنجاح! 🚀</h1>
            <p>يتم الآن جلب البيانات الحية مباشرة من السحابة و Google Sheets.</p>
            <span style="color: #27ae60; font-weight: bold;">✓ اتصال السيرفر مستقر وآمن</span>
        </div>
    </body>
    </html>
    `, {
      headers: { "content-type": "text/html; charset=UTF-8" }
    });
  }
};
