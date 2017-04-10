﻿using System.Threading.Tasks;
using AspNet.Security.OAuth.Validation;
using AspNet.Security.OpenIdConnect.Primitives;
using OpeniddictServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using OpenIddict.Core;
using System.Collections.Generic;

namespace OpeniddictServer.Controllers
{
    [Route("api")]
    public class UserinfoController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public UserinfoController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        //
        // GET: /api/userinfo
        [Authorize(ActiveAuthenticationSchemes = OAuthValidationDefaults.AuthenticationScheme)]
        [HttpGet("userinfo"), Produces("application/json")]
        public async Task<IActionResult> Userinfo()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return BadRequest(new OpenIdConnectResponse
                {
                    Error = OpenIdConnectConstants.Errors.InvalidGrant,
                    ErrorDescription = "The user profile is no longer available."
                });
            }

            var claims = new JObject();

            // Note: the "sub" claim is a mandatory claim and must be included in the JSON response.
            claims[OpenIdConnectConstants.Claims.Subject] = await _userManager.GetUserIdAsync(user);

            if (User.HasClaim(OpenIdConnectConstants.Claims.Scope, OpenIdConnectConstants.Scopes.Email))
            {
                claims[OpenIdConnectConstants.Claims.Email] = await _userManager.GetEmailAsync(user);
                claims[OpenIdConnectConstants.Claims.EmailVerified] = await _userManager.IsEmailConfirmedAsync(user);
            }

            if (User.HasClaim(OpenIdConnectConstants.Claims.Scope, OpenIdConnectConstants.Scopes.Phone))
            {
                claims[OpenIdConnectConstants.Claims.PhoneNumber] = await _userManager.GetPhoneNumberAsync(user);
                claims[OpenIdConnectConstants.Claims.PhoneNumberVerified] = await _userManager.IsPhoneNumberConfirmedAsync(user);
            }

            //destinations.Add(new Claim(JwtClaimTypes.Role, "dataEventRecords.admin"));
            //destinations.Add(new Claim(JwtClaimTypes.Role, "dataEventRecords.user"));
            //destinations.Add(new Claim(JwtClaimTypes.Role, "dataEventRecords"));
            //destinations.Add(new Claim(JwtClaimTypes.Scope, "dataEventRecords"));

            List<string> roles = new List<string> { "dataEventRecords", "dataEventRecords.admin", "admin", "dataEventRecords.user" };
            claims["role"] = JArray.FromObject(roles);

            //claims["roles"] = "admin";
            //claims["roles"] = "dataEventRecords";
            //claims["roles"] = "dataEventRecords.admin";

            //if (User.HasClaim(OpenIdConnectConstants.Claims.Scope, OpenIddictConstants.Scopes.Roles))
            //{
            //    List<string> roles = new List<string> { "dataEventRecords.admin", "admin" };
            //    claims["roles"] = JArray.FromObject(roles);
            //    // TODO  fix
            //    // claims["roles"] = JArray.FromObject(await _userManager.GetRolesAsync(user));
            //}

            // Note: the complete list of standard claims supported by the OpenID Connect specification
            // can be found here: http://openid.net/specs/openid-connect-core-1_0.html#StandardClaims

            return Json(claims);
        }
    }
}
