# Chrome Extension: Extract Instagram Usernames

Extension này giúp extract tất cả username từ bảng `<td data-label="Chi tiết">` và cho phép click để copy từng username một.

## Cách cài đặt

1. Mở Chrome, vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục `chrome-extract-usernames`

## Cách sử dụng

1. Mở trang web có bảng dữ liệu (như trang bạn đang dùng)
2. Click icon extension ở góc phải Chrome
3. Click vào username bất kỳ để copy
4. Hoặc click **Copy tất cả** để copy tất cả username

## Cấu trúc files

```
chrome-extract-usernames/
├── manifest.json    # Cấu hình extension
├── popup.html       # Giao diện popup
├── popup.js         # Logic popup
├── content.js       # Script chạy trên trang web
└── icon*.svg        # Icon (nên convert sang PNG để dùng)
```

## Lưu ý

- SVG icon cần được convert sang PNG (16x16, 48x48, 128x128) để hiển thị tốt trên Chrome
- Hoặc sử dụng icon mặc định của Chrome
