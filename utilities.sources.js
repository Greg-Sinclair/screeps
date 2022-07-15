module.exports = {
  'auditDevelopmentState':checkDevelopmentState,

}
function checkDevelopmentState(source) {
  if (!source.memory.devState){
    source.memory.devState = 'pending';
    return;
  }
  if (source.memory.devState == 'partial'){
    //audit to determine if the source is being used fully (meaning we're ready to move to the next one)
    //would be nice to figure out if the road to the controller is finished, but hard to imagine findPathTo is always symmetrical
    //that said, if it meets the other criteria might as well start sending creeps to the next source? only reason not to is if they're being spawned instead of builders... which is honestly plausible
    var path = source.pos.findPathTo(source.room.controller, {ignoreCreeps:true})
    for (var i in path){
      if (new RoomPosition(path[i].x, path[i].y, source.room.name).findInRange(FIND_MY_CONSTRUCTION_SITES, 1)){
        //this is a bit of a wide check but makes sense since getting through this would reduce the number of builders spawned due to Tx flags appearing at another source
        return;
      }
    }
    //if there are nearby Tx flags and the source is not consistently having its energy depleted, it's not fully developed
    if (source.pos.findInRange(FIND_FLAGS, 1).filter(function(flag){
      return (flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_RED && flag.memory.claimed != true)
    }).length == 0){
      source.memory.devState = 'complete';
    }
  }
}
