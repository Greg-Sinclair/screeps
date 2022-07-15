var roomUtilities = require('utilities.rooms');

var flag;

var worksiteFlag = {
  run: function (flag_) {
    flag = flag_
  // the build range is 3 squares, so place the flags every 4 + 7n steps (with extra check to make sure there is one near the end, ie 10 steps gets one at 4 and one at 10)
  //if there are no worksites within 3 tiles of the flag, delete
  if (flag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 3).length > 0){
    flag.remove();
    return;
  }

  //maintain a stockpile of energy on top of the flag, enough for 1 road
  var energy = flag.pos.findInRange(FIND_DROPPED_RESOURCES).filter(resourceType == RESOURCE_ENERGY)[0];
  if (energy){
    if (energy.amount >= 300){
      //set a flag so the workers know there's energy here? workers already check
      return;
    }
  }
  //if it gets this far, call for a carrier to drop energy here
  //set a flag in self that the carrier will check
  //I don't know the energy mechanics yet, does it stack the instances?


  }
};

module.exports = worksiteFlag;

//flags that are managed by creeps (ie their claimed values being set) should be handled entirely by the creeps. death checks go in th death checks. other types of flags go here

