id: CUI00114
cardType: continuousItem
name: CUI00114
level: 0
types:

o: static
applyTo: [from fights where COUNT([from participants where COUNT(abilities) = 0]) > 0]
condition: thisCard.zone = field
modifier: {useBaseValuesFor += [from participants where COUNT(abilities) = 0]}