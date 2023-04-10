


function removeCompleteFlags(){
	for (let flag of room.find(FIND_FLAGS, {filter: {color:COLOR_BLUE}})){
		if (flag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES,3).length == 0){
			flag.remove()
		}
	}
}