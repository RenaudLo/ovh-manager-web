angular.module("App").config(($stateProvider) => {
    "use strict";

    $stateProvider.state("app.hosting", {
        url: "/configuration/hosting/:productId?tab",
        templateUrl: "hosting/hosting.html",
        controller: "HostingCtrl",
        controllerAs: "ctrl",
        reloadOnSearch: false,
        params: {
            tab: null
        },
        resolve: {
            navigationInformations: [
                "Navigator",
                "$rootScope",
                (Navigator, $rootScope) => {
                    $rootScope.currentSectionInformation = "hosting";
                    return Navigator.setNavigationInformation({
                        leftMenuVisible: true,
                        configurationSelected: true
                    });
                }
            ],
            translator: ["translator", (translator) => translator.load(["hosting"]).then(() => translator)]
        }
    });
});
