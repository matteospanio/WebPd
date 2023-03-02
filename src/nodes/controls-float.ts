/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */
import { functional } from '@webpd/compiler-js'
import {
    Code,
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler-js/src/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../types'
import { assertNumber, assertOptionalString } from '../nodes-shared-code/validation'
import { build, declareControlSendReceive, EMPTY_BUS_NAME, messageSetSendReceive, ControlsBaseNodeArguments, stateVariables } from './controls-base'
import { messageBuses } from '../nodes-shared-code/buses'
import { bangUtils } from '../nodes-shared-code/core'

interface NodeArguments extends ControlsBaseNodeArguments {
    minValue: number
    maxValue: number
    initValue: number
    outputOnLoad: boolean
}

export type _NodeBuilder = NodeBuilder<NodeArguments>

export type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builderWithInit: _NodeBuilder = {
    translateArgs: ({
        args: [minValue, maxValue, init, initValue, receive, send],
    }: PdJson.SliderNode | PdJson.NumberBoxNode) => ({
        minValue: assertNumber(minValue),
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
}

const builderWithoutMin: _NodeBuilder = {
    translateArgs: ({
        args: [maxValue, init, initValue, receive, send],
    }: PdJson.ToggleNode | PdJson.RadioNode) => ({
        minValue: 0,
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
}

const makeNodeImplementation = ({
    prepareStoreValue,
    prepareStoreValueBang,
}: {
    prepareStoreValue?: (args: NodeArguments) => Code
    prepareStoreValueBang?: (args: NodeArguments) => Code
}): _NodeImplementation => {

    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = (context) => {
        const { 
            node, 
            state,
            snds,
            node: { id, args },
            compilation: { codeVariableNames: { nodes } },
            macros: { Var, Func }
        } = context
        return `
            let ${Var(state.value, 'Float')} = ${node.args.initValue}

            ${functional.renderIf(
                prepareStoreValue, 
                () => `function ${state.funcPrepareStoreValue} ${Func([
                    Var('value', 'Float')
                ], 'Float')} {
                    return ${prepareStoreValue(node.args)}
                }`
            )}

            ${functional.renderIf(
                prepareStoreValueBang, 
                () => `function ${state.funcPrepareStoreValueBang} ${Func([
                    Var('value', 'Float')
                ], 'Float')} {
                    return ${prepareStoreValueBang(node.args)}
                }`
            )}

            function ${state.funcMessageReceiver} ${Func([
                Var('m', 'Message'),
            ], 'void')} {
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${prepareStoreValue ? 
                        `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 0))`
                        : `${state.value} = msg_readFloatToken(m, 0)`}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (msg_isBang(m)) {
                    ${functional.renderIf(
                        prepareStoreValueBang, 
                        () => `${state.value} = ${state.funcPrepareStoreValueBang}(${state.value})`
                    )}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (
                    msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                    && msg_readStringToken(m, 0) === 'set'
                ) {
                    ${prepareStoreValue ? 
                        `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 1))`
                        : `${state.value} = msg_readFloatToken(m, 1)`}
                }
            
                ${messageSetSendReceive(context)}
            }

            ${declareControlSendReceive(context)}

            ${functional.renderIf(
                args.outputOnLoad, 
                `commons_waitFrame(0, () => ${snds.$0}(msg_floats([${state.value}])))`
            )}
        `
    }

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = (context) => {
        const { globs, state } = context
        return {
            '0': `
                ${state.funcMessageReceiver}(${globs.m})
                return
            `
        }
    }

    return {
        messages,
        declare,
        stateVariables,
        sharedCode: [bangUtils, messageBuses],
    }
}
// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'tgl': makeNodeImplementation({
        prepareStoreValueBang: ({ maxValue }) =>
            `value === 0 ? ${maxValue}: 0`
    }),
    'nbx': makeNodeImplementation({
        prepareStoreValue: ({ minValue, maxValue }) => 
            `Math.min(Math.max(value,${minValue}),${maxValue})`
    }),
    'hsl': makeNodeImplementation({}),
    'hradio': makeNodeImplementation({}),
}
nodeImplementations['vsl'] = nodeImplementations['hsl']
nodeImplementations['vradio'] = nodeImplementations['hradio']

const builders = {
    'tgl': builderWithoutMin,
    'nbx': builderWithInit,
    'hsl': builderWithInit,
    'vsl': builderWithInit,
    'hradio': builderWithoutMin,
    'vradio': builderWithoutMin,
}

export { builders, nodeImplementations, NodeArguments }