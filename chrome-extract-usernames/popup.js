document.addEventListener('DOMContentLoaded', () => {
  loadUsernames();
  
  document.getElementById('btnRefresh').addEventListener('click', loadUsernames);
  document.getElementById('btnCopyAll').addEventListener('click', copyAllUsernames);
});

function loadUsernames() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getUsernames' }, (response) => {
      if (response && response.usernames) {
        renderUsernames(response.usernames);
      } else {
        document.getElementById('usernameList').innerHTML = `
          <div class="empty">
            <p>Không tìm thấy bảng dữ liệu</p>
            <p style="margin-top:8px;font-size:11px;">Đảm bảo bạn đang ở trang có bảng dữ liệu</p>
          </div>
        `;
        document.getElementById('stats').textContent = '';
      }
    });
  });
}

function renderUsernames(usernames) {
  const list = document.getElementById('usernameList');
  const stats = document.getElementById('stats');
  
  stats.textContent = `Tìm thấy ${usernames.length} username`;
  
  if (usernames.length === 0) {
    list.innerHTML = '<div class="empty"><p>Không có username nào</p></div>';
    return;
  }
  
  list.innerHTML = usernames.map((username, index) => `
    <div class="username-item" data-username="${username}" onclick="copyUsername(this)">
      <span class="stt">${index + 1}</span>
      <span class="username">${username}</span>
      <span class="copy-icon">📋</span>
    </div>
  `).join('');
}

function copyUsername(element) {
  const username = element.dataset.username;
  navigator.clipboard.writeText(username).then(() => {
    const icon = element.querySelector('.copy-icon');
    icon.textContent = '✓';
    icon.classList.add('copied');
    showToast('Đã copy: ' + username);
    
    setTimeout(() => {
      icon.textContent = '📋';
      icon.classList.remove('copied');
    }, 1500);
  });
}

function copyAllUsernames() {
  const items = document.querySelectorAll('.username-item');
  const usernames = Array.from(items).map(item => item.dataset.username);
  
  if (usernames.length === 0) {
    showToast('Không có username để copy');
    return;
  }
  
  navigator.clipboard.writeText(usernames.join('\n')).then(() => {
    showToast(`Đã copy ${usernames.length} username!`);
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
