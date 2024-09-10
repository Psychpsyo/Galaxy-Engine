LOSELIFE(100);
if (you.life != 900) {
	opponent.WINGAME();
};

try {
	LOSELIFE(100);
} else {
	opponent.WINGAME();
};

try {
	LOSELIFE(0);
} then {
	opponent.WINGAME();
};

try {
	LOSELIFE(2000);
} then {
	opponent.WINGAME();
};
WINGAME();