// exports the base class for any AI implementation
export class AI {
	constructor(player) {
		this.player = player;
		player.aiSystem = this;
	}

	// this should return an input response object, just like a player would.
	async selectMove(optionList) {}
}