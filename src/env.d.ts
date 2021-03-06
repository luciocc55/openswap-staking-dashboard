/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module "vue3-popper" {
  import { Component } from "vue";
  const file: Component;
  export default file;
}
declare module "vue-css-donut-chart" {
  export default any;
}
interface Window {
  ethereum?: any;
}