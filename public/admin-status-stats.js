(() => {
  'use strict';

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function findMemberSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      const heading = String(section.querySelector('h3')?.textContent || '').toLowerCase();
      return heading.includes('registrovan') || heading.includes('registered member');
    }) || null;
  }

  function collectStatuses(shell) {
    const section = findMemberSection(shell);
    if (!section) return null;

    const byUser = new Map();
    section.querySelectorAll('[data-user-status]').forEach((select) => {
      const id = select.dataset.userStatus;
      if (id) byUser.set(id, String(select.value || '').toUpperCase());
    });

    if (!byUser.size) return null;

    const counts = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
    };

    byUser.forEach((status) => {
      if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    });

    return { total: byUser.size, counts };
  }

  function ensureCard(stats, key, value, label) {
    let card = stats.querySelector(`[data-membership-stat="${key}"]`);
    if (!card) {
      card = document.createElement('article');
      card.dataset.membershipStat = key;
      card.innerHTML = '<b></b><span></span>';
      stats.appendChild(card);
    }

    const number = card.querySelector('b');
    const text = card.querySelector('span');
    if (number && number.textContent !== String(value)) number.textContent = String(value);
    if (text && text.textContent !== label) text.textContent = label;
  }

  function enhance(shell) {
    const stats = shell.querySelector(':scope > .admin-stats');
    if (!stats) return;

    const data = collectStatuses(shell);
    if (!data) return;

    const originalCards = [...stats.querySelectorAll(':scope > article:not([data-membership-stat])')];
    const totalCard = originalCards[0];
    const pendingCard = originalCards[1];
    const approvedCard = originalCards[2];

    if (totalCard) {
      const b = totalCard.querySelector('b');
      const span = totalCard.querySelector('span');
      if (b && b.textContent !== String(data.total)) b.textContent = String(data.total);
      const label = isCzech() ? 'registrovaných osob celkem' : 'registered users total';
      if (span && span.textContent !== label) span.textContent = label;
    }

    if (pendingCard) {
      const b = pendingCard.querySelector('b');
      if (b && b.textContent !== String(data.counts.PENDING)) b.textContent = String(data.counts.PENDING);
    }

    if (approvedCard) {
      const b = approvedCard.querySelector('b');
      if (b && b.textContent !== String(data.counts.APPROVED)) b.textContent = String(data.counts.APPROVED);
    }

    ensureCard(
      stats,
      'rejected',
      data.counts.REJECTED,
      isCzech() ? 'zamítnutých registrací' : 'rejected registrations'
    );
    ensureCard(
      stats,
      'suspended',
      data.counts.SUSPENDED,
      isCzech() ? 'pozastavených členství' : 'suspended memberships'
    );

    const sum = data.counts.PENDING + data.counts.APPROVED + data.counts.REJECTED + data.counts.SUSPENDED;
    let check = stats.nextElementSibling;
    if (!check?.matches?.('.admin-membership-status-check')) {
      check = document.createElement('p');
      check.className = 'admin-membership-status-check';
      check.style.margin = '10px 0 0';
      check.style.fontSize = '13px';
      check.style.opacity = '.72';
      stats.after(check);
    }

    const equation = `${data.counts.APPROVED} + ${data.counts.PENDING} + ${data.counts.REJECTED} + ${data.counts.SUSPENDED} = ${sum}`;
    const message = isCzech()
      ? `Kontrola stavů: schváleno + čeká + zamítnuto + pozastaveno = ${equation}`
      : `Status check: approved + pending + rejected + suspended = ${equation}`;
    if (check.textContent !== message) check.textContent = message;
  }

  function scan() {
    document.querySelectorAll('.admin-shell').forEach(enhance);
  }

  scan();

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      scan();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
