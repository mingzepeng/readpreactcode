# preact 源码阅读
基于 preact v8.2.6 版本 


preact 是一个非常小巧精简的类 React 前端框架，提供和 React 一样的 API，但经过 zip 压缩后只有3kb，所以可以作为学习 React 和 vdom 的入门阅读代码。

preact 的 diff 是在 diff 的一次过程中，只保留最新的 vdom 节点，并将其和已经装载好的 dom 进行比较，在 diff 的过程中，如果存在不同之处，则会根据情况实时或者批次更新已存的 dom。

初次装载过程：

更新过程：


## component （Component 实例属性）

base 对应生成的真实 dom
props 组件属性
state 组件状态
_component render 中的 vdom 如果是组件，则指向该组件的实例，在加载后才会有这个值，该组件实例的 _parentComponent 属性指向 _component
_parentComponent 与 _component 相对应

## 常量值
NO_RENDER  
SYNC_RENDER  
FORCE_RENDER  调用组件的 forceUpdate
ASYNC_RENDER  