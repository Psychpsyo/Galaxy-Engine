if (thisCard.types = allTypes) {
	opponent.WINGAME();
};

APPLY(thisCard, {types += Water});
APPLY(thisCard, {types += Water});
if (thisCard.types != Water) {
	opponent.WINGAME();
};
if (COUNT(thisCard.types) != 1) {
	opponent.WINGAME();
};

APPLY(thisCard, {types += Fire});
if (COUNT(thisCard.types) != 2) {
	opponent.WINGAME();
};

APPLY(thisCard, {types = Earth});
if (thisCard.types = [Fire, Water]) {
	opponent.WINGAME();
};
if (thisCard.types != Earth) {
	opponent.WINGAME();
};

WINGAME();