function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}

export async function apiGet(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.json();
}

export async function apiPost(url, body) {
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
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
