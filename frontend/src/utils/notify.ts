import { createDiscreteApi } from 'naive-ui'

/**
 * 脱离组件上下文的全局消息提示。
 * App.vue 自身的 setup 在 NMessageProvider 之外，无法使用 useMessage；
 * 零散的非组件代码（工具函数、顶层错误提示）统一走这里。
 */
const { message } = createDiscreteApi(['message'])

export { message }
