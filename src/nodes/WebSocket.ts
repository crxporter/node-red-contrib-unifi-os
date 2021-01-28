import { NodeAPI } from 'node-red'
import WebSocketNodeConfigType from '../types/WebSocketNodeConfigType'
import WebSocketNodeType from '../types/WebSocketNodeType'
import AccessControllerNodeType from '../types/AccessControllerNodeType'
import WebSocket from 'ws'
import { endpoints } from '../Endpoints'
import { logger } from '@nrchkb/logger'

module.exports = (RED: NodeAPI) => {
    const setupWebsocket = async (self: WebSocketNodeType) => {
        const log = logger('WebSocket', self.name, self)

        const url =
            endpoints.protocol.webSocket +
            self.accessControllerNode.config.controllerIp +
            self.config.endpoint

        const connectWebSocket = async () => {
            self.ws = new WebSocket(url, {
                rejectUnauthorized: false,
                headers: {
                    Cookie: await self.accessControllerNode
                        .getAuthCookie()
                        .then((value) => value),
                },
            })

            if (!self.ws) {
                log.trace(
                    'Unable to connect to system events API. Will retry again later.'
                )

                self.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: 'Connecting...',
                })

                setTimeout(connectWebSocket, 5000)
            }
        }

        await connectWebSocket()

        self.ws.on('open', function open() {
            log.debug('Connection open')

            self.status({
                fill: 'green',
                shape: 'dot',
                text: 'Connection open',
            })
        })

        let tick = false
        self.ws.on('message', (data) => {
            const parsedData = JSON.parse(data.toString())

            self.send({
                payload: parsedData,
            })

            if (tick) {
                self.status({
                    fill: 'blue',
                    shape: 'ring',
                    text: 'Receiving data',
                })
            } else {
                self.status({
                    fill: 'grey',
                    shape: 'ring',
                    text: 'Receiving data',
                })
            }

            tick = !tick
        })

        self.ws.on('error', (error) => {
            log.error(`${error}`)

            self.status({
                fill: 'red',
                shape: 'dot',
                text: 'Error occurred',
            })
        })

        self.ws.on('close', () => {
            log.debug('Connection closed')

            self.status({
                fill: 'yellow',
                shape: 'dot',
                text: 'Connection closed',
            })

            connectWebSocket()
        })

        return self.ws
    }

    const init = function (
        this: WebSocketNodeType,
        config: WebSocketNodeConfigType
    ) {
        const self = this
        RED.nodes.createNode(self, config)
        self.config = config

        self.accessControllerNode = RED.nodes.getNode(
            self.config.accessControllerNodeId
        ) as AccessControllerNodeType

        if (!self.accessControllerNode) {
            self.status({
                fill: 'red',
                shape: 'dot',
                text: 'Access Controller not found',
            })
            return
        }

        self.name =
            self.config.name || self.accessControllerNode.name + ':' + self.id

        new Promise((resolve) => {
            const checkAndWait = () => {
                if (self.accessControllerNode.initialized) {
                    resolve(true)
                } else {
                    self.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Initializing...',
                    })

                    setTimeout(checkAndWait, 1500)
                }
            }

            checkAndWait()
        }).then(() => {
            body.call(self)
        })
    }

    const body = function (this: WebSocketNodeType) {
        const self = this
        const log = logger('WebSocket', self.name, self)

        setupWebsocket(self)

        self.status({
            fill: 'green',
            shape: 'dot',
            text: 'Initialized',
        })

        log.debug('Initialized')
    }

    // Register the requestHTTP node
    RED.nodes.registerType('unifi-web-socket', init)
}
