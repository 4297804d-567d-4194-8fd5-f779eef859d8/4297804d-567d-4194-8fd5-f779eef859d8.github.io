import BrowserDetector from '/assets/js/vendor/browser-dtector.min.js';

const onLoadZapthreads = async () => {
  const NOSTR_USER_PROFILES = 'nostr-user-profiles';

  const zapThreads = document.querySelector('zap-threads');
  if (!zapThreads) {
    return;
  }

  const nostrExtensionNotFoundModal = document.getElementById('nostrExtensionNotFoundModal');
  const loginModal = document.getElementById('loginModal');
  const loginButton = loginModal.querySelector('#loginButton');

  async function waitForExtensionInit(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        if (window.nostr) {
          clearInterval(intervalId);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(intervalId);
        resolve();
      }, timeoutMs);
    });
  }

  function getCookie(name) {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + '=')) {
        return JSON.parse(cookie.substring(name.length + 1));
      }
    }
    return {};
  }

  function setEndlessCookie(name, value) {
    if (!loginModal.querySelector('#allow-cookies-checkbox').checked) {
      return;
    }
    const jsonValue = JSON.stringify(value);
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 300);
    const expires = expiration.toUTCString();
    const domain = window.location.hostname;
    document.cookie = `${name}=${jsonValue};Expires=${expires};Path=/;SameSite=None;Secure;Domain=${domain}`;
  }

  // TODO: logoutAndRemoveCookie(pubkey)
  /*function removeCookie(name) {
    setCookie(name, '', new Date(0));
  }*/

  async function acceptLogin(pubkey) {
    const userProfiles = getCookie(NOSTR_USER_PROFILES);
    if (userProfiles[pubkey] === undefined) {
      userProfiles[pubkey] = {};
    }
    if (userProfiles[pubkey].allowAutoReports === undefined) {
      userProfiles[pubkey].allowAutoReports = loginModal.querySelector('#allow-auto-reports-checkbox').checked;
    }
    setEndlessCookie(NOSTR_USER_PROFILES, userProfiles);
    zapThreads.setAttribute('user', pubkey);
    zapThreads.removeAttribute('read-relays');
    await forceEventLoopCycle();
  }

  async function logout() {
    zapThreads.removeAttribute('user');
    await forceEventLoopCycle();
  }

  async function forceEventLoopCycle() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function recommendedExtension() {
    const browser = new BrowserDetector(window.navigator.userAgent).parseUserAgent().name;
    const extensions = {
      'Google Chrome': 'Keys.Band or nos2x',
      'Mozilla Firefox': 'nos2x-fox',
      'Safari': 'Nostore',
    };
    return browser && extensions[browser] || extensions['Google Chrome'];
  }

  function noExtensionLoginFailure() {
    const modal = new bootstrap.Modal(nostrExtensionNotFoundModal);
    nostrExtensionNotFoundModal.querySelector('span.extension-example').innerHTML = recommendedExtension();
    modal.show();
  }

  const loginIfKnownUser = async () => {
    if (!window.nostr) {
      return false;
    }
    const userProfiles = getCookie(NOSTR_USER_PROFILES);
    let expectedPubkey;
    try {
      expectedPubkey = Object.keys(userProfiles).length > 0 && await window.nostr.getPublicKey();
    } catch (e) {
      console.log(e);
    }
    const currentUserProfile = userProfiles[expectedPubkey];
    const knownUser = currentUserProfile !== undefined;
    if (knownUser) {
      await acceptLogin(expectedPubkey);
    } else {
      await logout();
    }
    return knownUser;
  };

  loginModal.querySelector('#accept-rules-checkbox').addEventListener('change', function() {
    loginButton.disabled = !this.checked;
  });

  loginModal.addEventListener('hidden.bs.modal', _ => {
    loginModal.querySelectorAll('.modal-body input[type="checkbox"]').forEach(function (checkbox) {
      checkbox.checked = true;
    });
  });

  ZapThreads
    .onLogin(async () => {
      if (!window.nostr) {
        noExtensionLoginFailure();
        return false;
      }
      if (await loginIfKnownUser()) {
        return true;
      }

      const modal = new bootstrap.Modal(loginModal);
      modal.show();

      const controller = new AbortController();
      await new Promise(resolve => {
        const options = {'once': true, 'signal': controller.signal};
        loginButton.addEventListener('click', async () => {
          try {
            const pubkey = await window.nostr.getPublicKey();
            await acceptLogin(pubkey);
          } catch (e) {
            alert(e.message);
            controller.abort();
          }
          resolve();
        }, options);
        loginModal.addEventListener('hidden.bs.modal', () => {
          controller.abort();
          resolve();
        }, options);
      });
      return !controller.signal.aborted;
    });

  await waitForExtensionInit();
  const knownUser = await loginIfKnownUser();
  if (!knownUser) {
    zapThreads.setAttribute('read-relays', ['wss://nos.lol', 'wss://nostr-relay.nokotaro.com', 'wss://nostr.bitcoiner.social', 'wss://nostr.einundzwanzig.space', 'wss://nostr.fmt.wiz.biz', 'wss://nostr.fractalized.net', 'wss://nostr.oxtr.dev', 'wss://offchain.pub', 'wss://relay.damus.io', 'wss://relay.mutinywallet.com', 'wss://relay.nostr.net', 'wss://relay.snort.social', 'wss://nostr.wine', 'wss://relay.damus.io', 'wss://relay.nostrplebs.com', 'wss://relay.nostr.band', 'ws://wat:8081', 'ws://wat:8080']); // TODO
    //zapThreads.setAttribute('read-relays', ['wss://relay.damus.io', 'wss://nos.lol']); // TODO
  }
};

const onLoadBeforeZapthreads = window.onload;
window.onload = async () => {
  if (onLoadBeforeZapthreads) {
    onLoadBeforeZapthreads();
  }
  await onLoadZapthreads();
};
