// @kivzdev/icons/motion — the motion toolkit the icons are made with, for icons of your own (createIcon) or to tune one:
// the recipes, the transitions, the curves (`ease.spring`…), and the clock (setClock, to drive time yourself in a test).

export * from './motion/recipes.js'
export * from './motion/transitions.js'
export * as ease from './motion/ease.js'
export { Ctx, type Box, type Pose, type Vec } from './motion/ctx.js'
export { Player, setClock, type Clock, type Run } from './motion/engine.js'
