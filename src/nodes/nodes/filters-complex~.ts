/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { Code, NodeImplementation, NodeImplementations } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'

interface NodeArguments {
    initCoeffRe: number
    initCoeffIm: number
}
const stateVariables = {
    lastInputRe: 1,
    lastInputIm: 1,
    lastOutputRe: 1,
    lastOutputIm: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : tests + cleaner implementations
// TODO : separate cfilters with lastInputRe lastInputIm from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initCoeffRe: assertOptionalNumber(args[0]) || 0,
        initCoeffIm: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
            '2': { type: 'signal', id: '2' },
            '3': { type: 'signal', id: '3' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { initCoeffIm, initCoeffRe }) => {
        if (inletId === '0') {
            return { initialSignalValue: 0 }
        }
        if (inletId === '1') {
            return { initialSignalValue: 0 }
        }
        if (inletId === '2') {
            return { initialSignalValue: initCoeffRe }
        }
        if (inletId === '3') {
            return { initialSignalValue: initCoeffIm }
        }
        return undefined
    },
}

const makeNodeImplementation = ({
    generateOperationRe,
    generateOperationIm,
}: {
    generateOperationRe: (
        inputRe: Code,
        inputIm: Code,
        coeffRe: Code,
        coeffIm: Code,
        lastOutputRe: Code,
        lastOutputIm: Code,
        lastInputRe: Code,
        lastInputIm: Code,
    ) => Code,
    generateOperationIm: (
        inputRe: Code,
        inputIm: Code,
        coeffRe: Code,
        coeffIm: Code,
        lastOutputRe: Code,
        lastOutputIm: Code,
        lastInputRe: Code,
        lastInputIm: Code,
    ) => Code,
}): _NodeImplementation => {

    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({
        state,
        macros: { Var },
    }) => `
        let ${Var(state.lastOutputRe, 'Float')} = 0
        let ${Var(state.lastOutputIm, 'Float')} = 0
        let ${Var(state.lastInputRe, 'Float')} = 0
        let ${Var(state.lastInputIm, 'Float')} = 0
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperationRe(
            ins.$0, 
            ins.$1, 
            ins.$2,
            ins.$3,
            state.lastOutputRe, 
            state.lastOutputIm, 
            state.lastInputRe, 
            state.lastInputIm
        )}
        ${state.lastOutputIm} = ${outs.$1} = ${generateOperationIm(
            ins.$0, 
            ins.$1,
            ins.$2,
            ins.$3,
            state.lastOutputRe, 
            state.lastOutputIm, 
            state.lastInputRe, 
            state.lastInputIm
        )}
        ${state.lastOutputRe} = ${outs.$0}
        ${state.lastInputRe} = ${ins.$0}
        ${state.lastInputIm} = ${ins.$1}
    `

    return {
        loop,
        stateVariables,
        declare,
    }
}

// ------------------------------------------------------------------- //
const builders = {
    'cpole~': builder,
    'czero~': builder,
}

const nodeImplementations: NodeImplementations = {
    'cpole~': makeNodeImplementation({
        // *outre++ = nextre + lastre * coefre - lastim * coefim
        generateOperationRe: (
            inputRe,
            _,
            coeffRe,
            coeffIm,
            lastOutputRe,
            lastOutputIm,
        ) => `${inputRe} + ${lastOutputRe} * ${coeffRe} - ${lastOutputIm} * ${coeffIm}`,
        // *outim++ = nextim + lastre * coefim + lastim * coefre;
        generateOperationIm: (
            _,
            inputIm,
            coeffRe,
            coeffIm,
            lastOutputRe,
            lastOutputIm,
        ) => `${inputIm} + ${lastOutputRe} * ${coeffIm} + ${lastOutputIm} * ${coeffRe}`,
    }),
    'czero~': makeNodeImplementation({
        // *outre++ = nextre - lastre * coefre + lastim * coefim;
        generateOperationRe: (
            inputRe,
            _,
            coeffRe,
            coeffIm,
            __,
            ___,
            lastInputRe,
            lastInputIm,
        ) => `${inputRe} - ${lastInputRe} * ${coeffRe} + ${lastInputIm} * ${coeffIm}`,
        // *outim++ = nextim - lastre * coefim - lastim * coefre;
        generateOperationIm: (
            _,
            inputIm,
            coeffRe,
            coeffIm,
            __,
            ___,
            lastInputRe,
            lastInputIm,
        ) => `${inputIm} - ${lastInputRe} * ${coeffIm} - ${lastInputIm} * ${coeffRe}`,
    }),
}

export { builders, nodeImplementations, NodeArguments }
