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

import { Code, functional } from '@webpd/compiler-js'
import {
    NodeImplementation,
    NodeImplementations,
    NodeVariableNames,
} from '@webpd/compiler-js/src/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../types'
import { bangUtils } from '../nodes-shared-code/core'
import { roundFloatAsPdInt } from '../nodes-shared-code/numbers'
import {
    messageTokenToFloat,
    messageTokenToString,
} from '../nodes-shared-code/type-arguments'

interface NodeArguments {
    tokenizedExpressions: Array<Array<ExpressionToken>>
}
const stateVariables = {
    floatInputs: 1,
    stringInputs: 1,
    outputs: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : Implement if (`if(<test>, <then>, <else>)`)
// ------------------------------- node builder ------------------------------ //
const builderExpr: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        tokenizedExpressions:
            preprocessExpression(args).map(tokenizeExpression),
    }),
    build: (args) => ({
        inlets: functional.mapArray(
            validateAndListInputsExpr(args.tokenizedExpressions),
            ({ id }) => [`${id}`, { type: 'message', id: `${id}` }]
        ),

        outlets: functional.mapArray(args.tokenizedExpressions, (_, i) => [
            `${i}`,
            { type: 'message', id: `${i}` },
        ]),
    }),
}

const builderExprTilde: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        tokenizedExpressions:
            preprocessExpression(args).map(tokenizeExpression),
    }),
    build: (args) => ({
        inlets: functional.mapArray(
            validateAndListInputsExprTilde(args.tokenizedExpressions),
            ({ id, type }) => [
                `${id}`,
                { type: type === 'signal' ? 'signal' : 'message', id: `${id}` },
            ]
        ),

        outlets: functional.mapArray(args.tokenizedExpressions, (_, i) => [
            `${i}`,
            { type: 'signal', id: `${i}` },
        ]),
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    node: { args, type },
    state,
    macros: { Var },
}) => {
    const inputs = type === 'expr' ? 
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal')

    return functional.renderCode`
        const ${Var(state.floatInputs, 'Map<Int, Float>')} = new Map()
        const ${Var(state.stringInputs, 'Map<Int, string>')} = new Map()
        const ${Var(state.outputs, 'Array<Float>')} = new Array(${args.tokenizedExpressions.length})
        ${inputs.filter(input => input.type === 'float' || input.type === 'int')
            .map(input => `${state.floatInputs}.set(${input.id}, 0)`)}
        ${inputs.filter(input => input.type === 'string')
            .map(input => `${state.stringInputs}.set(${input.id}, '')`)}
    `
}

// ------------------------------- loop ------------------------------ //
const loopExprTilde: _NodeImplementation['loop'] = ({
    node: { args },
    state,
    outs, 
    ins,
}) => `
    ${args.tokenizedExpressions.map((tokens, i) => 
        `${outs[i]} = ${renderTokenizedExpression(state, ins, tokens)}`)}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ 
    snds, 
    globs, 
    state, 
    node: { args, type },
    macros: { Var },
}) => {
    const inputs = type === 'expr' ? 
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal')
    
    const hasInput0 = inputs.length && inputs[0].id === 0

    return {
        '0': functional.renderCode`

        if (!msg_isBang(${globs.m})) {
            for (let ${Var('i', 'Int')} = 0; i < msg_getLength(${globs.m}); i++) {
                ${state.stringInputs}.set(i, messageTokenToString(${globs.m}, i))
                ${state.floatInputs}.set(i, messageTokenToFloat(${globs.m}, i))
            }
        }

        ${functional.renderIf(
            type === 'expr', 
            () => `
                ${args.tokenizedExpressions.map((tokens, i) => 
                    `${state.outputs}[${i}] = ${renderTokenizedExpression(state, null, tokens)}`)}
        
                ${args.tokenizedExpressions.map((_, i) => 
                    `${snds[`${i}`]}(msg_floats([${state.outputs}[${i}]]))`)}
            `
        )}
        
        return
        `,

        ...functional.mapArray(
            inputs.slice(hasInput0 ? 1 : 0), 
            ({ id, type }) => [
                `${id}`, 
                functional.renderSwitch(
                    [
                        type === 'float' || type === 'int',
                        `${state.floatInputs}.set(${id}, messageTokenToFloat(${globs.m}, 0));return`,
                    ],
                    [
                        type === 'string',
                        `${state.stringInputs}.set(${id}, messageTokenToString(${globs.m}, 0));return`,
                    ]
                )
            ]
        )
    }
}

// ------------------------------------------------------------------- //
export const TOKENIZE_REGEXP = /(?<f>\$f(?<id_f>[0-9]+))|(?<v>\$v(?<id_v>[0-9]+))|(?<i>\$i(?<id_i>[0-9]+))|(?<s>\$s(?<id_s>[0-9]+)\s*\[(?<sIndex>[^\[\]]*)\])/

interface ExpressionTokenFloat {
    type: 'float'
    id: number
}

interface ExpressionTokenSignal {
    type: 'signal'
    id: number
}

interface ExpressionTokenInt {
    type: 'int'
    id: number
}

interface ExpressionTokenString {
    type: 'string'
    id: number
}

interface ExpressionTokenIndexingStart {
    type: 'indexing-start'
}

interface ExpressionTokenIndexingEnd {
    type: 'indexing-end'
}

interface ExpressionTokenRaw {
    type: 'raw'
    content: string
}

type InputToken = ExpressionTokenString
    | ExpressionTokenFloat
    | ExpressionTokenInt
    | ExpressionTokenSignal

export type ExpressionToken = ExpressionTokenRaw
    | ExpressionTokenIndexingStart
    | ExpressionTokenIndexingEnd
    | InputToken

export const tokenizeExpression = (expression: string) => {
    let match: RegExpMatchArray
    let tokens: Array<ExpressionToken> = []
    while (match = TOKENIZE_REGEXP.exec(expression)) {
        if (match.index) {
            tokens.push({
                type: 'raw',
                content: expression.slice(0, match.index)
            })
        }

        if (match.groups['f']) {
            tokens.push({
                type: 'float',
                id: parseInt(match.groups['id_f']) - 1,
            })

        } else if (match.groups['v']) {
            tokens.push({
                type: 'signal',
                id: parseInt(match.groups['id_v']) - 1,
            })

        } else if (match.groups['i']) {
            tokens.push({
                type: 'int',
                id: parseInt(match.groups['id_i']) - 1,
            })
        
        // Symbols in an expr are used normally only to index an array.
        // Since we need to cast to an int to index an array, we need 
        // to wrap the indexing expression with a cast to int :
        // $s1[$i1 + 2] -> $s1[toInt($i1 + 2)]
        } else if (match.groups['s']) {
            tokens = [
                ...tokens, 
                {
                    type: 'string',
                    id: parseInt(match.groups['id_s']) - 1,
                },
                {
                    type: 'indexing-start'
                },
                ...tokenizeExpression(match.groups['sIndex']),
                {
                    type: 'indexing-end'
                },
            ]
        }
        expression = expression.slice(match.index + match[0].length)
    }
    if (expression.length) {
        tokens.push({
            type: 'raw',
            content: expression
        })
    }
    return tokens
}

export const renderTokenizedExpression = (
    state: { [Parameter in keyof typeof stateVariables]: string },
    ins: NodeVariableNames['ins'] | null,
    tokens: Array<ExpressionToken>, 
): Code =>
    // Add '+(' to convert for example boolean output to float
    '+(' + tokens.map(token => {
        switch(token.type) {
            case 'float':
                return `${state.floatInputs}.get(${token.id})`
            case 'signal':
                if (ins === null) {
                    throw new Error(`invalid token signal received`)
                }
                return ins[token.id]
            case 'int':
                return `roundFloatAsPdInt(${state.floatInputs}.get(${token.id}))`
            case 'string':
                return `commons_getArray(${state.stringInputs}.get(${token.id}))`
            case 'indexing-start':
                return '[toInt('
            case 'indexing-end':
                return ')]'
            case 'raw':
                return token.content
        }
    }).join('') + ')'

export const listInputs = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    const inputs: Array<InputToken> = []
    tokenizedExpressions.forEach(tokenizedExpression => {
        tokenizedExpression.forEach(token => {
            if (
                token.type === 'float' 
                || token.type === 'signal'
                || token.type === 'int'
                || token.type === 'string'
            ) {
                inputs.push(token)
            }
        })
    })

    // Sort so that input 0 appears first if it exists
    inputs.sort(({id: i1}, {id: i2}) => i1 - i2)
    const inputsMap = new Map<number, InputToken>()
    return inputs.filter(token => {
        if (inputsMap.has(token.id)) {
            if (inputsMap.get(token.id).type !== token.type) {
                throw new Error(`contradictory definitions for input ${token.id}`)
            }
            return false
        } else {
            inputsMap.set(token.id, token)
            return true
        }
    })
}

const validateAndListInputsExpr = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    const inputs = listInputs(tokenizedExpressions)
    inputs.forEach(input => {
        if (input.type === 'signal') {
            throw new Error(`invalid signal token $v# for [expr]`)      
        }
    })
    return inputs
}

const validateAndListInputsExprTilde = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    return listInputs(tokenizedExpressions)
}

const preprocessExpression = (args: PdJson.NodeArgs): Array<string> => {
    let expression = args.join(' ')

    // Get all Math functions from the expression and prefix them with `Math.`
    Object.getOwnPropertyNames(Math).forEach(funcName => {
        expression = expression.replaceAll(funcName, `Math.${funcName}`)
    })

    // Split the several outputs from the expression
    return expression.split(';')
        .map(expression => expression.trim())
}

const nodeImplementations: NodeImplementations = {
    'expr': {
        messages,
        stateVariables,
        declare,
        sharedCode: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
        ],
    },
    'expr~': {
        messages,
        stateVariables,
        declare,
        loop: loopExprTilde,
        sharedCode: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
        ],
    },
}

const builders = {
    'expr': builderExpr,
    'expr~': builderExprTilde,
}

export { builders, nodeImplementations, NodeArguments }