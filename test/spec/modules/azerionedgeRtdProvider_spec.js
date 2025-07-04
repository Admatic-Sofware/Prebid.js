import { config } from 'src/config.js';
import * as azerionedgeRTD from 'modules/azerionedgeRtdProvider.js';
import { loadExternalScriptStub } from 'test/mocks/adloaderStub.js';

describe('Azerion Edge RTD submodule', function () {
  const STORAGE_KEY = 'ht-pa-v1-a';
  const USER_AUDIENCES = [
    { id: '1', visits: 123 },
    { id: '2', visits: 456 },
  ];
  const IMPROVEDIGITAL_GVLID = '253';
  const key = 'publisher123';
  const bidders = ['appnexus', 'improvedigital'];
  const process = { key: 'value' };
  const dataProvider = { name: 'azerionedge', waitForIt: true };
  const userConsent = {gdpr: {gdprApplies: 'gdpr-applies', consentString: 'consent-string'}, usp: 'usp'};

  const resetAll = () => {
    window.azerionPublisherAudiences.resetHistory();
    loadExternalScriptStub.resetHistory();
  }

  let reqBidsConfigObj;
  let storageStub;

  beforeEach(function () {
    config.resetConfig();
    reqBidsConfigObj = { ortb2Fragments: { bidder: {} } };
    window.azerionPublisherAudiences = sinon.spy();
    storageStub = sinon.stub(azerionedgeRTD.storage, 'getDataFromLocalStorage');
  });

  afterEach(function () {
    delete window.azerionPublisherAudiences;
    storageStub.restore();
  });

  describe('initialisation', function () {
    let returned;

    beforeEach(function () {
      returned = azerionedgeRTD.azerionedgeSubmodule.init(dataProvider, userConsent);
    });

    it('should have the correct gvlid', () => {
      expect(azerionedgeRTD.azerionedgeSubmodule.gvlid).to.equal(IMPROVEDIGITAL_GVLID);
    });

    it('should return true', function () {
      expect(returned).to.equal(true);
    });

    it('should load external script', function () {
      expect(loadExternalScriptStub.called).to.be.true;
    });

    it('should load external script with default versioned url', function () {
      const expected = 'https://edge.hyth.io/js/v1/azerion-edge.min.js';
      expect(loadExternalScriptStub.args[0][0]).to.deep.equal(expected);
    });

    [
      ['gdprApplies', userConsent.gdpr.gdprApplies],
      ['gdprConsent', userConsent.gdpr.consentString],
      ['uspConsent', userConsent.usp],
    ].forEach(([key, value]) => {
      it(`should call azerionPublisherAudiencesStub with ${key}:${value}`, function () {
        expect(window.azerionPublisherAudiences.args[0][0]).to.include({[key]: value});
      });
    });

    describe('with key', function () {
      beforeEach(function () {
        resetAll();
        const config = { ...dataProvider, params: { key } };
        returned = azerionedgeRTD.azerionedgeSubmodule.init(config, userConsent);
      });

      it('should return true', function () {
        expect(returned).to.equal(true);
      });

      it('should load external script with publisher id url', function () {
        const expected = `https://edge.hyth.io/js/v1/${key}/azerion-edge.min.js`;
        expect(loadExternalScriptStub.args[0][0]).to.deep.equal(expected);
      });
    });

    describe('with process configuration', function () {
      beforeEach(function () {
        resetAll();
        const config = { ...dataProvider, params: { process } };
        returned = azerionedgeRTD.azerionedgeSubmodule.init(config, userConsent);
      });

      it('should return true', function () {
        expect(returned).to.equal(true);
      });

      [
        ['gdprApplies', userConsent.gdpr.gdprApplies],
        ['gdprConsent', userConsent.gdpr.consentString],
        ['uspConsent', userConsent.usp],
        ...Object.entries(process),
      ].forEach(([key, value]) => {
        it(`should call azerionPublisherAudiencesStub with ${key}:${value}`, function () {
          expect(window.azerionPublisherAudiences.args[0][0]).to.include({[key]: value});
        });
      });
    });
  });

  describe('gets audiences', function () {
    let callbackStub;

    beforeEach(function () {
      callbackStub = sinon.mock();
    });

    describe('with empty storage', function () {
      beforeEach(function () {
        azerionedgeRTD.azerionedgeSubmodule.getBidRequestData(
          reqBidsConfigObj,
          callbackStub,
          dataProvider
        );
      });

      it('does not apply audiences to bidders', function () {
        expect(reqBidsConfigObj.ortb2Fragments.bidder).to.deep.equal({});
      });

      it('calls callback anyway', function () {
        expect(callbackStub.called).to.be.true;
      });
    });

    describe('with populate storage', function () {
      beforeEach(function () {
        storageStub
          .withArgs(STORAGE_KEY)
          .returns(JSON.stringify(USER_AUDIENCES));
        azerionedgeRTD.azerionedgeSubmodule.getBidRequestData(
          reqBidsConfigObj,
          callbackStub,
          dataProvider
        );
      });

      it('does apply audiences to bidder', function () {
        const segments =
          reqBidsConfigObj.ortb2Fragments.bidder['improvedigital'].user.data[0]
            .segment;
        expect(segments).to.deep.equal([{ id: '1' }, { id: '2' }]);
      });

      it('calls callback always', function () {
        expect(callbackStub.called).to.be.true;
      });
    });
  });

  describe('sets audiences in bidder', function () {
    const audiences = USER_AUDIENCES.map(({ id }) => id);
    const expected = {
      user: {
        data: [
          {
            ext: { segtax: 4 },
            name: 'azerionedge',
            segment: [{ id: '1' }, { id: '2' }],
          },
        ],
      },
    };

    it('for improvedigital by default', function () {
      azerionedgeRTD.setAudiencesToBidders(
        reqBidsConfigObj,
        dataProvider,
        audiences
      );
      expect(
        reqBidsConfigObj.ortb2Fragments.bidder['improvedigital']
      ).to.deep.equal(expected);
    });

    bidders.forEach((bidder) => {
      it(`for ${bidder}`, function () {
        const config = { ...dataProvider, params: { bidders } };
        azerionedgeRTD.setAudiencesToBidders(reqBidsConfigObj, config, audiences);
        expect(reqBidsConfigObj.ortb2Fragments.bidder[bidder]).to.deep.equal(
          expected
        );
      });
    });
  });
});
