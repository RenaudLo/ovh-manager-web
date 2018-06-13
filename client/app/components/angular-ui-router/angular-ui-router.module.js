angular
    .module("App")
    .config(($transitionsProvider) => {

        /* =============================================
        =            TRANSLATION RESOLVABLE            =
        ============================================== */

        /*
            Translations loading from ui state resolve
         */

        const getStateTranslationParts = (state) => {
            let result = state.translations || [];
            if (state.views) {
                angular.forEach(state.views, (value) => {

                    if (_.isUndefined(value.noTranslations) && !value.noTranslations) {
                        if (value.translations) {
                            result = _.union(result, value.translations);
                        }
                    }
                });
            }
            return _.uniq(result);
        };

        $transitionsProvider.onBefore({}, (transition) => {
            transition.addResolvable({
                token: "translations",
                deps: ["$translate", "$translatePartialLoader", "$state"],
                resolveFn: ($translate, $translatePartialLoader, $state) => {
                    const state = transition.to();
                    const stateParts = state.name.match(/[^\.]+/g);
                    const stateList = [];
                    let stateName = "";

                    angular.forEach(stateParts, (part) => {
                        stateName = stateName ? `${stateName}.${part}` : part;
                        stateList.push(stateName);
                    });

                    angular.forEach(stateList, (stateElt) => {
                        const translations = getStateTranslationParts($state.get(stateElt));
                        angular.forEach(translations, (part) => {
                            $translatePartialLoader.addPart(part);
                        });
                    });

                    return $translate.refresh();
                }
            });
        });

        /* -----  End of TRANSLATION RESOLVABLE  ------ */

    });
