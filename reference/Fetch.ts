
export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
for (let attempt = 0; attempt <= retries; attempt++) {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

try {
const response = await fetch(url, { ...options, signal: controller.signal });
clearTimeout(timeoutId);

if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}

return await response.json();
} catch (error) {
clearTimeout(timeoutId);

if (attempt < retries) {
console.warn(`Retrying... attempt ${attempt + 1}`);
await new Promise(res => setTimeout(res, delay * (2 ** attempt)));
} else {
console.error('All retries failed');
throw error;
}
}
}
}
