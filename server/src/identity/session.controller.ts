import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Inject,
  HttpCode,
} from '@nestjs/common'
import type { Response } from 'express'
import { type Identity, type AuthenticatedRequest } from './sessions.ts'
import { IDENTITY } from '../persistence/tokens.ts'
@Controller('/v1/session')
export class SessionController {
  constructor(@Inject(IDENTITY) private identity: Identity) {}
  @Post('/login') @HttpCode(200) async login(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.identity.login(req)
    res.cookie(this.identity.cookieName, token, {
      httpOnly: true,
      secure: this.identity.config.production,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    })
    return { authenticated: true }
  }
  @Get('/me') me(@Req() req: AuthenticatedRequest) {
    return req.principal
  }
  @Get('/csrf') csrf(@Req() req: AuthenticatedRequest) {
    return { token: this.identity.csrf(req) }
  }
  @Post('/logout') @HttpCode(200) async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.identity.logout(req.principal!)
    res.clearCookie(this.identity.cookieName, {
      httpOnly: true,
      secure: this.identity.config.production,
      sameSite: 'lax',
      path: '/',
    })
    return { authenticated: false }
  }
}
