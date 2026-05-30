# المرحلة الأولى: البناء
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# المرحلة الثانية: خادم الويب
FROM nginx:alpine
# نسخ ملفات البناء من المرحلة السابقة إلى مجلد Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# نسخ إعدادات Nginx (اختياري، Nginx الافتراضي يعمل جيداً)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
