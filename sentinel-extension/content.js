// content.js - Purely extracts email context from Gmail
function extractGmailData() {
  const subjectEl = document.querySelector('h2[data-thread-perm-id]');
  const subject = subjectEl ? subjectEl.innerText : 'Unknown Subject';

  const messageBodies = document.querySelectorAll('div.a3s.aiL');
  let bodyText = '';
  let links = [];
  let images = [];
  let activeMessage = null;

  if (messageBodies.length > 0) {
    activeMessage = messageBodies[messageBodies.length - 1];
    bodyText = activeMessage.innerText;
    
    const anchors = activeMessage.querySelectorAll('a[href]');
    anchors.forEach(a => {
      if (a.href.startsWith('http')) links.push({ url: a.href, text: a.innerText });
    });

    const imgTags = activeMessage.querySelectorAll('img');
    imgTags.forEach(img => {
      if (img.width > 30 || img.height > 30) images.push({ src: img.src, alt: img.alt });
    });
  } else {
    bodyText = document.body.innerText.substring(0, 5000); 
  }

  let sender = 'unknown_sender@example.com';
  if (activeMessage) {
    // In Gmail, the sender is usually highlighted with class 'gD'. If we grab the last span[email], we accidentally grab the 'To:' field (the user's own email).
    const headerBlock = activeMessage.closest('.gs') || document;
    
    // First try the specific sender class
    let senderEl = headerBlock.querySelector('span.gD[email]');
    
    // Fallback if UI changes: get the very first email span (usually From)
    if (!senderEl) {
      senderEl = headerBlock.querySelector('span[email]');
    }
    
    if (senderEl) {
      sender = senderEl.getAttribute('email');
    }
  } else {
    const senderEls = document.querySelectorAll('span[email]');
    if (senderEls.length > 0) sender = senderEls[senderEls.length - 1].getAttribute('email');
  }

  return {
    subject,
    sender,
    bodyText: bodyText.substring(0, 10000),
    links: links.slice(0, 10),
    images: images.slice(0, 5)
  };
}

// Return the extracted data to the background executeScript caller
extractGmailData();
