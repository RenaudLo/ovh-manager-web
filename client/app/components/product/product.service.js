angular.module("services").service("Products", [
    "$rootScope",
    "$http",
    "$q",
    "constants",
    "$stateParams",
    "AllDom",
    "Emails",
    function ($rootScope, $http, $q, constants, $stateParams, AllDom, Emails) {
        "use strict";

        let products = null;
        let productsByType = null;
        let selectedProduct = {
            name: "",
            organization: "",
            type: ""
        };

        const requests = {
            productsList: null
        };

        function resetCache () {
            products = null;
            productsByType = null;
            requests.productsList = null;
        }

        /*
         * get product by SWS
         */
        this.getProducts = function (forceRefresh) {
            if (forceRefresh === true) {
                resetCache();
            }
            return $q
                .when(true)
                .then(() => {
                    if (products) {
                        return products;
                    }

                    if (requests.productsList !== null) {
                        return requests.productsList;
                    }

                    requests.productsList = $q
                        .all([
                            $http.get("/sws/products", {
                                serviceType: "aapi",
                                params: {
                                    universe: constants.universe || "WEB",
                                    worldPart: constants.target
                                }
                            }),
                            AllDom.getAllDoms(true),
                            Emails.getDelegatedEmails()
                        ])
                        .then((data) => this.concatProducts(data));
                })
                .then(() => products, (reason) => $q.reject(reason));
        };

        this.concatProducts = function (data) {
            const result = data[0];
            const allDoms = data[1];

            if (result.status >= 300) {
                return $q.reject(data);
            }

            productsByType = result.data;

            _.forEach(data[2], (email) => {
                const splitted = email.split("@");
                if (splitted.length >= 2) {
                    if (_.find(productsByType.emails, { name: splitted[1] }) == null) {
                        const domain = splitted[1];
                        productsByType.emails.push({
                            displayName: domain,
                            hasSubComponent: false,
                            name: domain,
                            type: "EMAIL_DELEGATE",
                            delegate: true
                        });
                    }
                }
            });

            /* Exchange 25g */
            if (productsByType && productsByType.platforms && productsByType.platforms.length) {
                // 1. Remove all occurances and put them in other var
                let exchangeOld = _.remove(productsByType.platforms, (a) => a.type === "EXCHANGE_OLD");
                if (exchangeOld && exchangeOld.length) {
                    // 2. Merge all domain to an uniq array
                    exchangeOld = _.uniq(exchangeOld, (a) => a.name);

                    // 3. Push to products array
                    productsByType.platforms = productsByType.platforms.concat(exchangeOld);
                }
            }

            if (!products) {
                products = [];
            }

            if (!allDoms || allDoms.length <= 0) {
                ["domains", "hostings", "exchanges", "sharepoints", "vps", "cdns", "emails", "licenseOffice", "emailPros"].forEach((type) => {
                    products = products.concat(productsByType[type] || []);
                });

                return products;
            }

            return this.handleAllDoms(allDoms);
        };

        this.handleAllDoms = function (allDoms) {
            let productDomains = [];
            const allDomains = _.pluck(productsByType.domains, "name");
            const allDomainsOnly = _.pluck(productsByType.domains.filter((x) => x.type === "DOMAIN"), "name");
            const allZones = _.pluck(productsByType.domains.filter((x) => x.type === "ZONE" && allDomainsOnly.indexOf(x.name) === -1), "name");

            productsByType.allDoms = [];
            return $q
                .allSettled(
                    allDoms.map((allDom) =>
                        AllDom.getDomains(allDom).then(
                            (domains) => {
                                productDomains = productDomains.concat(allDomains.filter((d) => !~domains.indexOf(d)));

                                productsByType.allDoms.push({
                                    name: allDom,
                                    displayName: allDom,
                                    hasSubComponent: true,
                                    type: "ALL_DOM",
                                    subProducts: _.intersection(allDomains, domains).map((d) => ({
                                        name: d,
                                        displayName: d,
                                        allDomName: allDom,
                                        allDomZoneOnly: allZones.indexOf(d) !== -1,
                                        type: allZones.indexOf(d) !== -1 ? "ZONE" : "ALL_DOM"
                                    }))
                                });
                            },
                            (err) => ({ error: err, allDom })
                        )
                    )
                )
                .then(() => {
                    if (productsByType.allDoms.length > 0) {
                        const d = productsByType.domains.filter((domain) => ~productDomains.indexOf(domain.name));

                        productsByType.domains = productsByType.allDoms.concat(_.sortBy(d, (elt) => elt.name));
                    }

                    ["domains", "hostings", "exchanges", "sharepoints", "vps", "cdns", "emails", "licenseOffice", "allDoms", "emailPros"].forEach((type) => {
                        products = products.concat(productsByType[type] || []);
                    });

                    return products;
                });
        };

        /*
         * Get list of products orderBy Type
         */
        this.getProductsByType = function () {
            return this.getProducts().then(() => productsByType);
        };

        /*
         * Get the selected product
         */
        this.getSelectedProduct = function (forceRefresh) {
            if (forceRefresh) {
                selectedProduct = {
                    name: "",
                    organization: "",
                    type: ""
                };
            }

            return this.getProducts(forceRefresh).then((prods) => {
                const emptyProduct = {
                    name: "",
                    organization: "",
                    type: ""
                };

                if ($.isEmpty(selectedProduct.name)) {
                    selectedProduct.name = $stateParams.productId ? $stateParams.productId : "";
                    selectedProduct.type = $rootScope.currentSectionInformation ? $rootScope.currentSectionInformation.toUpperCase() : null;
                    selectedProduct.organization = $stateParams.organization ? $stateParams.organization : "";

                    if (selectedProduct.name === "") {
                        return emptyProduct;
                    }
                }

                const found = _.find(prods, (prod) => {
                    const check = (p) => p.name === selectedProduct.name && p.type === selectedProduct.type;

                    if (check(prod)) {
                        return prod;
                    } else if (prod.hasSubComponent) {
                        return _.find(prod.subProducts, check);
                    }

                    return null;
                });

                return found || emptyProduct;
            });
        };

        /*
         * set the selected product by Id
         */
        this.setSelectedProduct = function (product) {
            if (product) {
                if (angular.isString(product)) {
                    selectedProduct.name = product;
                } else if (angular.isObject(product)) {
                    if (product.name === "" && product.type === "") {
                        selectedProduct = product;
                    } else {
                        selectedProduct.name = product.name;
                        selectedProduct.type = product.type;
                    }
                }
            }

            return this.getSelectedProduct().then((p) => {
                selectedProduct.type = p.type;
                $rootScope.$broadcast("changeSelectedProduct", p);
                return p;
            });
        };

        /*
         * set the selected product by Id
         */
        this.removeSelectedProduct = function () {
            return this.setSelectedProduct({
                name: "",
                type: ""
            }).then((p) => {
                $rootScope.$broadcast("removeSelectedProduct");
                return p;
            });
        };

        /**
         * Get working-status for the specified product
         */
        this.getWorks = function (product) {
            return $http.get(`${constants.aapiRootPath}working-status/${product}`).then((resp) => resp.data);
        };

        this.getProducts(true);
    }
]);
