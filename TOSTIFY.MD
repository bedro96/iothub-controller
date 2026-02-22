# Vue3 Toastify

Vue3 Toastify는 Vue3 애플리케이션에서 간편하게 사용할 수 있는 toast 알림 라이브러리입니다.

---

## 설치방법 (Installation)

### npm

```bash
npm install vue3-toastify
```

### yarn

```bash
yarn add vue3-toastify
```

### pnpm

```bash
pnpm add vue3-toastify
```

---

## 설정방법 (Setup)

### main.ts / main.js에 플러그인 등록

```typescript
import { createApp } from 'vue';
import App from './App.vue';
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

const app = createApp(App);

app.use(Vue3Toastify, {
  autoClose: 3000,
} as ToastContainerOptions);

app.mount('#app');
```

---

## 사용방법 (Usage)

### 기본 사용법

```vue
<script setup lang="ts">
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

function showToast() {
  toast('Hello, World!');
}
</script>

<template>
  <button @click="showToast">Toast 표시</button>
</template>
```

---

### Toast 타입별 사용법

```typescript
import { toast } from 'vue3-toastify';

// 기본 (default)
toast('기본 메시지입니다.');

// 성공 (success)
toast.success('작업이 성공적으로 완료되었습니다!');

// 오류 (error)
toast.error('오류가 발생했습니다.');

// 경고 (warning)
toast.warning('주의가 필요합니다.');

// 정보 (info)
toast.info('참고할 정보입니다.');
```

---

### 옵션 설정

```typescript
import { toast } from 'vue3-toastify';

toast.success('저장 완료!', {
  position: toast.POSITION.TOP_RIGHT,  // 위치: TOP_RIGHT, TOP_LEFT, TOP_CENTER, BOTTOM_RIGHT, BOTTOM_LEFT, BOTTOM_CENTER
  autoClose: 5000,                      // 자동 닫힘 시간 (ms), false 시 자동닫힘 비활성화
  hideProgressBar: false,               // 진행바 숨김 여부
  closeOnClick: true,                   // 클릭 시 닫힘 여부
  pauseOnHover: true,                   // 호버 시 타이머 일시정지
  draggable: true,                      // 드래그 가능 여부
  theme: 'auto',                        // 테마: 'light', 'dark', 'auto', 'colored'
});
```

---

### Promise 기반 Toast (로딩 → 완료 전환)

```typescript
import { toast } from 'vue3-toastify';

const myPromise = fetchData(); // 비동기 작업

toast.promise(myPromise, {
  pending: '데이터를 불러오는 중...',
  success: '데이터 로드 완료!',
  error: '데이터 로드 실패.',
});
```

---

### Toast 수동 제어

```typescript
import { toast } from 'vue3-toastify';

// Toast ID를 사용해 특정 toast 닫기
const toastId = toast('처리 중...', { autoClose: false });

// 작업 완료 후 닫기
toast.done(toastId);

// 특정 ID의 toast 업데이트
toast.update(toastId, {
  render: '완료되었습니다!',
  type: 'success',
  autoClose: 3000,
});

// 모든 toast 닫기
toast.clearAll();
```

---

## 전역 기본값 설정

```typescript
import Vue3Toastify from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

app.use(Vue3Toastify, {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'auto',
  multiple: true,  // 여러 toast 동시 표시 허용
  limit: 5,        // 최대 표시 개수
});
```

---

## 참고 링크 (References)

- [npm 패키지](https://www.npmjs.com/package/vue3-toastify)
- [공식 GitHub](https://github.com/jerrywu001/vue3-toastify)
- [공식 문서](https://vue3-toastify.js-bridge.com/)
