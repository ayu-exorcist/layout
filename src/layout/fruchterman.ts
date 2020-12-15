/**
 * @fileOverview fruchterman layout
 * @author shiwu.wyy@antfin.com
 */

import { OutNode, Edge, PointTuple, IndexMap, Point } from './types'
import { Base } from './base'
import { isNumber } from '../util'

type NodeMap = {
  [key: string]: INode
}

type INode = OutNode & {
  cluster: string
}

const SPEED_DIVISOR = 800

/**
 * fruchterman 布局
 */
export class FruchtermanLayout extends Base {
  /** 布局中心 */
  public center: PointTuple

  /** 停止迭代的最大迭代数 */
  public maxIteration: number = 1000

  /** 重力大小，影响图的紧凑程度 */
  public gravity: number = 10

  /** 速度 */
  public speed: number = 1

  /** 是否产生聚类力 */
  public clustering: boolean = false

  /** 聚类力大小 */
  public clusterGravity: number = 10

  public nodes: INode[] = []

  public edges: Edge[] = []

  public width: number = 300

  public height: number = 300

  public nodeMap: NodeMap = {}

  public nodeIdxMap: IndexMap = {}

  constructor(options?: FruchtermanLayout.FruchtermanLayoutOptions) {	
    super()	
    this.updateCfg(options)	
  }

  public getDefaultCfg() {
    return {
      maxIteration: 1000,
      gravity: 10,
      speed: 1,
      clustering: false,
      clusterGravity: 10,
    }
  }

  /**
   * 执行布局
   */
  public execute() {
    const self = this
    const nodes = self.nodes

    if (!nodes || nodes.length === 0) {
      return
    }

    if (!self.width && typeof window !== 'undefined') {
      self.width = window.innerWidth
    }
    if (!self.height && typeof window !== 'undefined') {
      self.height = window.innerHeight
    }
    if (!self.center) {
      self.center = [self.width / 2, self.height / 2]
    }
    const center = self.center
    
    if (nodes.length === 1) {
      nodes[0].x = center[0]
      nodes[0].y = center[1]
      return
    }
    const nodeMap: NodeMap = {}
    const nodeIdxMap: IndexMap = {}
    nodes.forEach((node, i) => {
      if (!isNumber(node.x)) node.x = Math.random() * this.width
      if (!isNumber(node.y)) node.y = Math.random() * this.height
      nodeMap[node.id] = node
      nodeIdxMap[node.id] = i
    })
    self.nodeMap = nodeMap
    self.nodeIdxMap = nodeIdxMap
    // layout
    self.run()
  }

  public run() {
    const self = this
    const nodes = self.nodes
    const edges = self.edges
    const maxIteration = self.maxIteration
    const center = self.center
    const area = self.height * self.width
    const maxDisplace = Math.sqrt(area) / 10
    const k2 = area / (nodes.length + 1)
    const k = Math.sqrt(k2)
    const gravity = self.gravity
    const speed = self.speed
    const clustering = self.clustering
    const clusterMap: {
      [key: string]: {
        name: string | number
        cx: number
        cy: number
        count: number
      }
    } = {}
    if (clustering) {
      nodes.forEach((n) => {
        if (clusterMap[n.cluster] === undefined) {
          const cluster = {
            name: n.cluster,
            cx: 0,
            cy: 0,
            count: 0,
          }
          clusterMap[n.cluster] = cluster
        }
        const c = clusterMap[n.cluster]
        if (isNumber(n.x)) {
          c.cx += n.x
        }
        if (isNumber(n.y)) {
          c.cy += n.y
        }
        c.count++
      })
      for (const key in clusterMap) {
        clusterMap[key].cx /= clusterMap[key].count
        clusterMap[key].cy /= clusterMap[key].count
      }
    }
    for (let i = 0; i < maxIteration; i++) {
      const displacements: Point[] = []
      nodes.forEach((_, j) => {
        displacements[j] = { x: 0, y: 0 }
      })
      self.applyCalculate(nodes, edges, displacements, k, k2)

      // gravity for clusters
      if (clustering) {
        const clusterGravity = self.clusterGravity || gravity
        nodes.forEach((n, j) => {
          if (!isNumber(n.x) || !isNumber(n.y)) return
          const c = clusterMap[n.cluster]
          const distLength = Math.sqrt((n.x - c.cx) * (n.x - c.cx) + (n.y - c.cy) * (n.y - c.cy))
          const gravityForce = k * clusterGravity
          displacements[j].x -= (gravityForce * (n.x - c.cx)) / distLength
          displacements[j].y -= (gravityForce * (n.y - c.cy)) / distLength
        })

        for (const key in clusterMap) {
          clusterMap[key].cx = 0
          clusterMap[key].cy = 0
          clusterMap[key].count = 0
        }

        nodes.forEach((n) => {
          const c = clusterMap[n.cluster]
          if (isNumber(n.x)) {
            c.cx += n.x
          }
          if (isNumber(n.y)) {
            c.cy += n.y
          }
          c.count++
        })
        for (const key in clusterMap) {
          clusterMap[key].cx /= clusterMap[key].count
          clusterMap[key].cy /= clusterMap[key].count
        }
      }

      // gravity
      nodes.forEach((n, j) => {
        if (!isNumber(n.x) || !isNumber(n.y)) return
        const gravityForce = 0.01 * k * gravity
        displacements[j].x -= gravityForce * (n.x - center[0])
        displacements[j].y -= gravityForce * (n.y - center[1])
      })

      // move
      nodes.forEach((n, j) => {
        if (!isNumber(n.x) || !isNumber(n.y)) return
        const distLength = Math.sqrt(
          displacements[j].x * displacements[j].x + displacements[j].y * displacements[j].y,
        )
        if (distLength > 0) {
          // && !n.isFixed()
          const limitedDist = Math.min(maxDisplace * (speed / SPEED_DIVISOR), distLength)
          n.x += (displacements[j].x / distLength) * limitedDist
          n.y += (displacements[j].y / distLength) * limitedDist
        }
      })
    }
  }

  private applyCalculate(nodes: INode[], edges: Edge[], displacements: Point[], k: number, k2: number) {
    const self = this
    self.calRepulsive(nodes, displacements, k2)
    self.calAttractive(edges, displacements, k)
  }

  private calRepulsive(nodes: INode[], displacements: Point[], k2: number) {
    nodes.forEach((v, i) => {
      displacements[i] = { x: 0, y: 0 }
      nodes.forEach((u, j) => {
        if (i === j) {
          return
        }
        if (!isNumber(v.x) || !isNumber(u.x) || !isNumber(v.y) || !isNumber(u.y)) return
        let vecX = v.x - u.x
        let vecY = v.y - u.y
        let vecLengthSqr = vecX * vecX + vecY * vecY
        if (vecLengthSqr === 0) {
          vecLengthSqr = 1
          const sign = i > j ? 1 : -1
          vecX = 0.01 * sign
          vecY = 0.01 * sign
        }
        const common = (k2) / vecLengthSqr
        displacements[i].x += vecX * common
        displacements[i].y += vecY * common
      })
    })
  }

  private calAttractive(edges: Edge[], displacements: Point[], k: number) {
    edges.forEach((e) => {
      if (!e.source || !e.target) return
      const uIndex = this.nodeIdxMap[e.source]
      const vIndex = this.nodeIdxMap[e.target]
      if (uIndex === vIndex) {
        return
      }
      const u = this.nodeMap[e.source]
      const v = this.nodeMap[e.target]
      if (!isNumber(v.x) || !isNumber(u.x) || !isNumber(v.y) || !isNumber(u.y)) return
      const vecX = v.x - u.x
      const vecY = v.y - u.y
      const vecLength = Math.sqrt(vecX * vecX + vecY * vecY)
      const common = (vecLength * vecLength) / k
      displacements[vIndex].x -= (vecX / vecLength) * common
      displacements[vIndex].y -= (vecY / vecLength) * common
      displacements[uIndex].x += (vecX / vecLength) * common
      displacements[uIndex].y += (vecY / vecLength) * common
    })
  }

  public getType() {
    return 'fruchterman'
  }
}

export namespace FruchtermanLayout {	
  export interface FruchtermanLayoutOptions {
    type: 'fruchterman'	
    center?: PointTuple	
    maxIteration?: number
    width?: number
    height?: number
    gravity?: number
    speed?: number
    clustering?: boolean
    clusterGravity?: number
    workerEnabled?: boolean
    gpuEnabled?: boolean
  }	
}