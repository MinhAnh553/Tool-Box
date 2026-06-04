// Content script - chạy trên trang web
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsernames') {
    const usernames = extractUsernames();
    sendResponse({ usernames: usernames });
  }
  return true;
});

function extractUsernames() {
  const usernames = [];
  
  // Tìm tất cả các td với data-label="Chi tiết"
  const cells = document.querySelectorAll('td[data-label="Chi tiết"]');
  
  cells.forEach(cell => {
    // Lấy textContent và loại bỏ khoảng trắng thừa
    const text = cell.textContent.trim();
    
    // Tách theo | và lấy phần đầu tiên là username
    const parts = text.split('|');
    if (parts.length > 0) {
      const username = parts[0].trim();
      if (username && username.length > 0) {
        usernames.push(username);
      }
    }
  });
  
  return usernames;
}
