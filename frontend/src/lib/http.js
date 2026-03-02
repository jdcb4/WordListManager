function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}

export async function apiGet(url, options = {}) {
  const response = await fetch(url, { credentials: "include", signal: options.signal });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.json();
}

export async function apiPost(url, body, options = {}) {
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `POST ${url} failed with ${response.status}`);
  }
  return payload;
}

export async function apiPostForm(url, formData, options = {}) {
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: options.signal,
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `POST ${url} failed with ${response.status}`);
  }
  return payload;
}
