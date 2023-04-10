



function findEmptyFlag(){
	let flags = room.find(FIND_FLAGS, {filter: function(flag){
		return flag.color == COLOR_BLUE && flag.pos.lookFor(LOOK_CREEPS).length == 0;
	}})
	return flags.length == 0 ? null:flags[0];
}