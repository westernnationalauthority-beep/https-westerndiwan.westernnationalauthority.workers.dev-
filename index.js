import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. التعامل مع عملية إرسال بيانات الدخول (POST)
    if (request.method === "POST") {
      const formData = await request.formData();
      const username = formData.get("username");
      const password = formData.get("password");

      // هنا يمكنك مستقبلاً التحقق من البيانات عبر قاعدة بيانات Neon
      if (username === "admin" && password === "123456") {
        return new Response(`
          <div style="text-align:center; font-family:sans-serif; margin-top:50px; direction:rtl;">
            <h1 style="color:#2ecc71;">تم تسجيل الدخول بنجاح! 🎉</h1>
            <p>مرحباً بك يا ${username} في لوحة التحكم الخاص بك.</p>
            <a href="/">العودة للخلف</a>
          </div>
        `, { headers: { "content-type": "text/html; charset=UTF-8" } });
      } else {
        return new Response(`
          <div style="text-align:center; font-family:sans-serif; margin-top:50px; direction:rtl;">
            <h1 style="color:#e74c3c;">خطأ في تسجيل الدخول! ❌</h1>
            <p>اسم المستخدم أو كلمة المرور غير صحيحة.</p>
            <a href="/">حاول مجدداً</a>
          </div>
        `, { headers: { "content-type": "text/html; charset=UTF-8" } });
      }
    }

    // 2. عرض شاشة الدخول الرئيسية (GET)
    const loginHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تسجيل الدخول | ديوان الويب</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #74ebd5, #9face6);
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .login-container {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                width: 100%;
                max-width: 400px;
                text-align: center;
            }
            h2 { color: #2c3e50; margin-bottom: 25px; font-size: 26px; }
            .input-group {
                text-align: right;
                margin-bottom: 20px;
            }
            label { display: block; margin-bottom: 8px; color: #555; font-size: 14px; }
            input {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-sizing: border-box;
                font-size: 16px;
                transition: 0.3s;
            }
            input:focus { border-color: #74ebd5; outline: none; }
            .btn {
                width: 100%;
                padding: 12px;
                background: #4a00e0;
                background: linear-gradient(to right, #8e2de2, #4a00e0);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: 0.3s;
                margin-top: 10px;
            }
            .btn:hover { opacity: 0.9; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h2>تسجيل الدخول</h2>
            <form method="POST" action="/">
                <div class="input-group">
                    <label for="username">اسم المستخدم أو البريد الإلكتروني</label>
                    <input type="text" id="username" name="username" required placeholder="أدخل اسم المستخدم">
                </div>
                <div class="input-group">
                    <label for="password">كلمة المرور</label>
                    <input type="password" id="password" name="password" required placeholder="أدخل كلمة المرور">
                </div>
                <button type="submit" class="btn">دخول</button>
            </form>
        </div>
    </body>
    </html>
    `;

    return new Response(loginHtml, {
      headers: { "content-type": "text/html; charset=UTF-8" },
    });
  },
};
