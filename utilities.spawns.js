var roomUtilities = require('utilities.rooms');

module.exports = {
  'carrierFeedTimeoutCheck':carrierFeedTimeoutCheck,
  'updateNearestSource':updateNearestSource,


}

function carrierFeedTimeoutCheck(spawn) {
  const FEED_TIMEOUT = 120
  if (!spawn.memory.feedTimeout){
    spawn.memory.feedTimeout = 0;
  }
  if (spawn.memory.carrierOnRoute){
    if (spawn.memory.feedTimeout > FEED_TIMEOUT){
      spawn.memory.carrierOnRoute = false;
      spawn.memory.feedTimeout = 0;
    }
    else{
      spawn.memory.feedTimeout++;
    }
  }
}
function updateNearestSource(spawn){
  var nearestSource = spawn.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps:true, filter:function(source){
    return roomUtilities.isSpaceSafe(source.pos) && (source.memory.devState == 'partial' || source.memory.devState == 'complete')
  }});
  if (nearestSource){
    spawn.memory.nearestSource = nearestSource.id;
  }
  else{
    spawn.memory.nearestSource = null;

  }
}
