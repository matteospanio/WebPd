var _ = require('underscore')
  , assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , portlets = require('../lib/waa/portlets')
  , PdObject = require('../lib/core/PdObject')
  , Pd = require('../index')
  , pdGlob = require('../lib/global')
  , utils = require('../lib/core/utils')

exports.afterEach = function() {
  pdGlob.namedObjects.reset()
  pdGlob.patches = {}
  pdGlob.library = {}
  require('../lib').declareObjects(pdGlob.library)
  Pd.stop()
}

exports.beforeEach = function() {
  pdGlob.library['testingmailbox'] = TestingMailBox
}

exports.assertPreservesTimeTag = function(pdObject, args) {
  var mailbox = pdObject.patch.createObject('testingmailbox')
    , timeTag = Math.random()
  utils.timeTag(args, timeTag)
  pdObject.o(0).connect(mailbox.i(0))
  pdObject.i(0).message(args)
  assert.equal(mailbox.rawReceived[0].timeTag, timeTag)
}

var round = exports.round = function(num, dec) {
  dec = dec || 6
  return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec)
}

exports.assertAboutEqual = function(array1, array2) {
  array1 = _.map(array1, function(val) { return round(val, 6) })
  array2 = _.map(array2, function(val) { return round(val, 6) })
  assert.deepEqual(array1, array2)
}

var TestingMailBox = exports.TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() {
    this.received = []
    this.rawReceived = []
    this.events = new EventEmitter()
  },
  inletDefs: [
    portlets.Inlet.extend({
      message: function(args) {
        this.obj.outlets[0].message(args)
        this.obj.rawReceived.push(args)
        this.obj.received.push(args.slice(0))
        this.obj.events.emit('message')
      }
    })
  ],
  outletDefs: [ portlets.Outlet ]
})

var TestAudio = exports.TestAudio = function() {
  this.time = 0
  this.sampleRate = 44100
  this.blockSize = 4096
  this.channelCount = 2
  this.buffer = []
}

TestAudio.prototype.start = function() {}
TestAudio.prototype.stop = function() {}


var TestClock = exports.TestClock = function() {
  this.events = []
}

TestClock.prototype.schedule = function(func, time, repetition) {
  var event = { func: func, timeTag: time, repetition: repetition }
  this.events.push(event)
  if (event.timeTag === pdGlob.audio.time) event.func(event)
  return event
}

TestClock.prototype.unschedule = function(event) { this.events = _.without(this.events, event) }

TestClock.prototype.tick = function() {
  var self = this
  this.events.forEach(function(e) {
    if (e.repetition) {
      if (pdGlob.audio.time >= e.timeTag && ((pdGlob.audio.time - e.timeTag) % e.repetition) === 0) { 
        var e = _.extend(e, { timeTag: pdGlob.audio.time })
        e.func(e)
      }
    } else if (e.timeTag === pdGlob.audio.time) e.func(e)
  })
}
